/**
 * Multi-provider AI system with automatic fallback.
 * Chain: OpenRouter → Nvidia → Google Gemini → OpenAI
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

// Provider names
export const PROVIDERS = {
    OPENROUTER: 'openrouter',
    GEMINI: 'gemini',
    OPENAI: 'openai',
    NVIDIA: 'nvidia',
    LOCAL: 'local',
};

const TEXT_TIMEOUT_MS = 15000;
const OPENROUTER_TIMEOUT_MS = 50000; // Parallel race — wait up to 50s for any model to respond
const VISION_TIMEOUT_MS = 24000;

function withTimeout(promise, timeoutMs, label) {
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
        }),
    ]);
}

function getNvidiaApiKey(envKey) {
    return process.env[envKey] || process.env.NVIDIA_API_KEY || '';
}

function getNvidiaTextModelConfigs() {
    return [
        {
            model: 'qwen/qwen3.5-122b-a10b',
            apiKey: getNvidiaApiKey('NVIDIA_QWEN_API_KEY'),
            temperature: 0.6,
            max_tokens: 2800,
            timeoutMs: 8000,
            extra_body: {
                chat_template_kwargs: {
                    enable_thinking: false,
                },
            },
        },
        {
            model: 'deepseek-ai/deepseek-v3.2',
            apiKey: getNvidiaApiKey('NVIDIA_DEEPSEEK_V32_API_KEY'),
            temperature: 0.4,
            max_tokens: 2400,
            timeoutMs: 7000,
            extra_body: {
                chat_template_kwargs: {
                    thinking: false,
                },
            },
        },
        {
            model: 'deepseek-ai/deepseek-v3.1',
            apiKey: getNvidiaApiKey('NVIDIA_DEEPSEEK_V31_API_KEY'),
            temperature: 0.2,
            max_tokens: 2200,
            top_p: 0.7,
            timeoutMs: 6000,
            extra_body: {
                chat_template_kwargs: {
                    thinking: false,
                },
            },
        },
        {
            model: 'z-ai/glm4.7',
            apiKey: getNvidiaApiKey('NVIDIA_GLM47_API_KEY'),
            temperature: 1,
            max_tokens: 2600,
            top_p: 1,
            timeoutMs: 6000,
            extra_body: {
                chat_template_kwargs: {
                    enable_thinking: false,
                    clear_thinking: false,
                },
            },
        },
    ];
}

/**
 * Parse JSON from AI response text (handles markdown fences, etc.)
 */
function normalizeJSONCandidate(text) {
    return text
        .replace(/^\uFEFF/, '')
        .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '')
        .replace(/,\s*([}\]])/g, '$1')
        .trim();
}

function tryParseCandidate(text) {
    return JSON.parse(normalizeJSONCandidate(text));
}

function extractBalancedJSONObject(text) {
    const starts = [];

    for (let i = 0; i < text.length; i++) {
        if (text[i] === '{') starts.push(i);
    }

    for (const start of starts) {
        let depth = 0;
        let inString = false;
        let escaped = false;

        for (let i = start; i < text.length; i++) {
            const char = text[i];

            if (inString) {
                if (escaped) {
                    escaped = false;
                } else if (char === '\\') {
                    escaped = true;
                } else if (char === '"') {
                    inString = false;
                }
                continue;
            }

            if (char === '"') {
                inString = true;
                continue;
            }

            if (char === '{') depth += 1;
            if (char === '}') depth -= 1;

            if (depth === 0) {
                const candidate = text.slice(start, i + 1);
                try {
                    return tryParseCandidate(candidate);
                } catch {
                    break;
                }
            }
        }
    }

    return null;
}

function parseJSONResponse(text) {
    // Try direct parse
    try {
        return tryParseCandidate(text);
    } catch {
        // Try extracting from code fences
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            return tryParseCandidate(jsonMatch[1].trim());
        }

        const balancedObject = extractBalancedJSONObject(text);
        if (balancedObject) {
            return balancedObject;
        }

        const objMatches = text.match(/\{[\s\S]*?\}/g);
        if (objMatches) {
            for (const match of objMatches) {
                try {
                    return tryParseCandidate(match);
                } catch {
                    // keep trying candidates
                }
            }
        }
        throw new Error('Could not parse AI response as JSON');
    }
}

/**
 * Check if an error is a quota/rate-limit error that should trigger fallback
 */
function isQuotaError(error) {
    const msg = (error?.message || '').toLowerCase();
    const status = error?.status || error?.statusCode || 0;
    return (
        status === 429 ||
        status === 503 ||
        msg.includes('quota') ||
        msg.includes('rate limit') ||
        msg.includes('too many requests') ||
        msg.includes('exceeded') ||
        msg.includes('resource_exhausted') ||
        msg.includes('insufficient_quota')
    );
}

// ─── Gemini Provider ───

async function geminiGenerateText(prompt, apiKey) {
    const genAI = new GoogleGenerativeAI(apiKey);

    // Try gemini-2.0-flash first, fall back to 1.5-flash (separate quota bucket)
    const models = ['gemini-2.0-flash', 'gemini-1.5-flash-latest'];
    let lastErr;
    for (const modelId of models) {
        try {
            const model = genAI.getGenerativeModel({ model: modelId });
            const result = await withTimeout(model.generateContent(prompt), TEXT_TIMEOUT_MS, `Gemini ${modelId} text request`);
            return result.response.text();
        } catch (err) {
            lastErr = err;
            // Only fall back on quota/rate errors, not auth errors
            if (!isQuotaError(err)) throw err;
        }
    }
    throw lastErr;
}

async function geminiGenerateVision(prompt, imageBase64, mimeType, apiKey) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await withTimeout(
        model.generateContent([
            prompt,
            { inlineData: { data: imageBase64, mimeType } },
        ]),
        VISION_TIMEOUT_MS,
        'Gemini vision request'
    );
    return result.response.text();
}

// ─── OpenAI Provider ───

async function openaiGenerateText(prompt, apiKey) {
    const openai = new OpenAI({ apiKey });
    const completion = await withTimeout(
        openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'You are a helpful nutrition and grocery analytics AI. Always respond with valid JSON only, no markdown formatting.' },
                { role: 'user', content: prompt },
            ],
            temperature: 0.7,
            max_tokens: 4096,
        }),
        TEXT_TIMEOUT_MS,
        'OpenAI text request'
    );
    return completion.choices[0].message.content;
}

async function openaiGenerateVision(prompt, imageBase64, mimeType, apiKey) {
    const openai = new OpenAI({ apiKey });
    const completion = await withTimeout(
        openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:${mimeType};base64,${imageBase64}`,
                            },
                        },
                    ],
                },
            ],
            temperature: 0.7,
            max_tokens: 4096,
        }),
        VISION_TIMEOUT_MS,
        'OpenAI vision request'
    );
    return completion.choices[0].message.content;
}

// ─── Nvidia Provider ───

async function nvidiaGenerateText(prompt) {
    const modelConfigs = getNvidiaTextModelConfigs();
    const errors = [];

    for (const config of modelConfigs) {
        if (!config.apiKey) {
            errors.push(`${config.model}: No API key configured`);
            continue;
        }

        try {
            const nvidia = new OpenAI({
                apiKey: config.apiKey,
                baseURL: 'https://integrate.api.nvidia.com/v1',
            });
            const completion = await withTimeout(
                nvidia.chat.completions.create({
                    model: config.model,
                    messages: [
                        { role: 'system', content: 'You are a helpful nutrition and grocery analytics AI. Always respond with valid JSON only, no markdown formatting.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: config.temperature,
                    max_tokens: config.max_tokens,
                    top_p: config.top_p ?? 0.95,
                    extra_body: config.extra_body,
                }),
                config.timeoutMs ?? TEXT_TIMEOUT_MS,
                `${config.model} request`
            );
            return completion.choices[0].message.content;
        } catch (error) {
            errors.push(`${config.model}: ${error.message}`);
        }
    }

    throw new Error(`Nvidia text models failed. ${errors.join(' | ')}`);
}

async function nvidiaGenerateVision(prompt, imageBase64, mimeType, apiKey) {
    const nvidia = new OpenAI({ 
        apiKey, 
        baseURL: 'https://integrate.api.nvidia.com/v1',
    });
    // Fallback vision model on Nvidia standard catalog, e.g., meta/llama-3.2-90b-vision-instruct
    const completion = await withTimeout(
        nvidia.chat.completions.create({
            model: 'meta/llama-3.2-90b-vision-instruct',
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:${mimeType};base64,${imageBase64}`,
                            },
                        },
                    ],
                },
            ],
            temperature: 0.15,
            max_tokens: 2048,
        }),
        VISION_TIMEOUT_MS,
        'Nvidia vision request'
    );
    return completion.choices[0].message.content;
}

// ─── OpenRouter Provider ───

// All free models on OpenRouter — raced in parallel so first response wins.
// Rate-limited models fail fast (<1s) so they don't slow things down.
const OPENROUTER_TEXT_MODELS = [
    'liquid/lfm-2.5-1.2b-instruct:free',              // Very fast (3-4s), good JSON
    'google/gemma-3-12b-it:free',                      // Reliable mid-size
    'google/gemma-3-27b-it:free',                      // Larger Gemma
    'meta-llama/llama-3.3-70b-instruct:free',          // Large Llama
    'nousresearch/hermes-3-llama-3.1-405b:free',       // Very large, excellent JSON
    'minimax/minimax-m2.5:free',                       // Large model
    'openai/gpt-oss-20b:free',                         // OSS via OpenRouter
    'openai/gpt-oss-120b:free',                        // Large OSS model
    'nvidia/nemotron-3-super-120b-a12b:free',          // Nvidia large
    'nvidia/nemotron-nano-9b-v2:free',                 // Nvidia smaller
    'arcee-ai/trinity-large-preview:free',             // Trinity large
    'arcee-ai/trinity-mini:free',                      // Trinity mini
    'cognitivecomputations/dolphin-mistral-24b-venice-edition:free', // Dolphin 24B
    'meta-llama/llama-3.2-3b-instruct:free',           // Small fast Llama
];

async function openrouterGenerateText(prompt, apiKey) {
    const client = new OpenAI({
        apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
            'HTTP-Referer': 'https://foodlimit.app',
            'X-Title': 'FoodLimit',
        },
    });

    // Race all models in parallel — first valid response wins, rest are cancelled
    const attempts = OPENROUTER_TEXT_MODELS.map(async (model) => {
        const completion = await withTimeout(
            client.chat.completions.create({
                model,
                messages: [
                    { role: 'system', content: 'You are a helpful nutrition and grocery analytics AI. Always respond with valid JSON only, no markdown formatting.' },
                    { role: 'user', content: prompt },
                ],
                temperature: 0.4,
                max_tokens: 3200,
            }),
            OPENROUTER_TIMEOUT_MS,
            `OpenRouter ${model} request`
        );
        const text = completion.choices[0]?.message?.content;
        if (!text) throw new Error(`${model}: Empty response`);
        return text;
    });

    // Promise.any — resolves with first success, rejects only if ALL fail
    try {
        return await Promise.any(attempts);
    } catch (aggregateErr) {
        const msgs = aggregateErr.errors?.map((e, i) =>
            `${OPENROUTER_TEXT_MODELS[i]}: ${e.message}`
        ) || [aggregateErr.message];
        throw new Error(`OpenRouter models failed. ${msgs.join(' | ')}`);
    }
}

// ─── Public API ───

/**
 * Generate a text response with automatic provider fallback.
 * Chain: OpenRouter → Nvidia → Gemini → OpenAI → throw
 * Returns { text, provider }
 */
export async function generateText(prompt) {
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const hasNvidiaTextKey = getNvidiaTextModelConfigs().some((config) => Boolean(config.apiKey));
    const errors = [];

    // 1. Try OpenRouter (free models, no quota issues)
    if (openrouterKey) {
        try {
            const text = await openrouterGenerateText(prompt, openrouterKey);
            return { text, provider: PROVIDERS.OPENROUTER };
        } catch (err) {
            errors.push(`OpenRouter: ${err.message}`);
            console.warn('OpenRouter failed, falling back to Nvidia:', err.message);
        }
    } else {
        errors.push('OpenRouter: No API key configured');
    }

    // 2. Try Nvidia
    if (hasNvidiaTextKey) {
        try {
            const text = await nvidiaGenerateText(prompt);
            return { text, provider: PROVIDERS.NVIDIA };
        } catch (err) {
            errors.push(`Nvidia: ${err.message}`);
        }
    } else {
        errors.push('Nvidia: No text model API key configured');
    }

    // 3. Try Gemini
    if (geminiKey) {
        try {
            const text = await geminiGenerateText(prompt, geminiKey);
            return { text, provider: PROVIDERS.GEMINI };
        } catch (err) {
            errors.push(`Gemini: ${err.message}`);
        }
    }

    // 4. Try OpenAI
    if (openaiKey) {
        try {
            const text = await openaiGenerateText(prompt, openaiKey);
            return { text, provider: PROVIDERS.OPENAI };
        } catch (err) {
            errors.push(`OpenAI: ${err.message}`);
        }
    }

    // 5. None available
    throw new Error(`All AI providers failed. ${errors.join(' | ')}`);
}

/**
 * Generate a JSON response with automatic provider fallback.
 * Parses the JSON from the response text.
 * Returns { data, provider }
 */
export async function generateJSON(prompt) {
    const { text, provider } = await generateText(prompt);
    const data = parseJSONResponse(text);
    return { data, provider };
}

/**
 * Generate a vision (image analysis) response with fallback.
 * Chain: Nvidia → Gemini → OpenAI → throw
 * Returns { text, provider }
 */
export async function generateVision(prompt, imageBase64, mimeType) {
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const nvidiaKey = getNvidiaApiKey('NVIDIA_VISION_API_KEY');
    const errors = [];

    // 1. Try Nvidia vision
    if (nvidiaKey) {
        try {
            const text = await nvidiaGenerateVision(prompt, imageBase64, mimeType, nvidiaKey);
            return { text, provider: PROVIDERS.NVIDIA };
        } catch (err) {
            errors.push(`Nvidia: ${err.message}`);
            if (!isQuotaError(err)) {
                console.warn('Nvidia vision error, falling back to Gemini:', err.message);
            }
        }
    } else {
        errors.push('Nvidia: No API key configured');
    }

    // 2. Try Gemini
    if (geminiKey) {
        try {
            const text = await geminiGenerateVision(prompt, imageBase64, mimeType, geminiKey);
            return { text, provider: PROVIDERS.GEMINI };
        } catch (err) {
            errors.push(`Gemini: ${err.message}`);
            if (!isQuotaError(err)) {
                console.warn('Gemini vision non-quota error, falling back to OpenAI:', err.message);
            }
        }
    }

    // 3. Try OpenAI
    if (openaiKey) {
        try {
            const text = await openaiGenerateVision(prompt, imageBase64, mimeType, openaiKey);
            return { text, provider: PROVIDERS.OPENAI };
        } catch (err) {
            errors.push(`OpenAI: ${err.message}`);
            console.warn('OpenAI vision error:', err.message);
        }
    }

    // 4. None available
    throw new Error(
        `All AI vision providers failed. ${errors.join(' | ')}${!geminiKey && !openaiKey && !nvidiaKey ? ' No API keys configured.' : ''}`
    );
}

/**
 * Generate a vision JSON response with fallback.
 * If the vision model returns text (not JSON), pipes through text model for structuring.
 * Returns { data, provider }
 */
export async function generateVisionJSON(prompt, imageBase64, mimeType) {
    const { text, provider } = await generateVision(prompt, imageBase64, mimeType);

    // Try parsing JSON directly
    try {
        const data = parseJSONResponse(text);
        return { data, provider };
    } catch (parseErr) {
        // If Nvidia returned text instead of JSON, pipe through text model for structuring
        if (provider === PROVIDERS.NVIDIA) {
            const hasNvidiaTextKey = getNvidiaTextModelConfigs().some((config) => Boolean(config.apiKey));
            console.log('Nvidia vision returned text, structuring via text model...');
            try {
                if (hasNvidiaTextKey) {
                    const structureResponse = await nvidiaGenerateText(
                        `${prompt}\n\nHere is the text extracted from a receipt image:\n\n${text}\n\nBased on this extracted text, return ONLY valid JSON. No markdown, no explanations, no code fences.`
                    );
                    const structured = parseJSONResponse(structureResponse);
                    return { data: structured, provider: PROVIDERS.NVIDIA };
                }
            } catch (structErr) {
                console.warn('Nvidia text structuring failed:', structErr.message);
            }
        }
        // Re-throw original parse error if structuring also failed
        throw parseErr;
    }
}
