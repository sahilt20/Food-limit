/**
 * Multi-provider AI system with automatic fallback.
 * Chain: Google Gemini → OpenAI → Ollama (local) → template fallback
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

// Provider names
export const PROVIDERS = {
    GEMINI: 'gemini',
    OPENAI: 'openai',
    NVIDIA: 'nvidia',
    LOCAL: 'local',
};

/**
 * Parse JSON from AI response text (handles markdown fences, etc.)
 */
function parseJSONResponse(text) {
    // Try direct parse
    try {
        return JSON.parse(text);
    } catch {
        // Try extracting from code fences
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[1].trim());
        }
        // Try finding JSON object
        const objMatch = text.match(/\{[\s\S]*\}/);
        if (objMatch) {
            return JSON.parse(objMatch[0]);
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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    return result.response.text();
}

async function geminiGenerateVision(prompt, imageBase64, mimeType, apiKey) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent([
        prompt,
        { inlineData: { data: imageBase64, mimeType } },
    ]);
    return result.response.text();
}

// ─── OpenAI Provider ───

async function openaiGenerateText(prompt, apiKey) {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: 'You are a helpful nutrition and grocery analytics AI. Always respond with valid JSON only, no markdown formatting.' },
            { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 4096,
    });
    return completion.choices[0].message.content;
}

async function openaiGenerateVision(prompt, imageBase64, mimeType, apiKey) {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
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
    });
    return completion.choices[0].message.content;
}

// ─── Nvidia Provider ───

async function nvidiaGenerateText(prompt, apiKey) {
    const nvidia = new OpenAI({ 
        apiKey, 
        baseURL: 'https://integrate.api.nvidia.com/v1',
    });
    const completion = await nvidia.chat.completions.create({
        model: 'deepseek-ai/deepseek-v3.2',
        messages: [
            { role: 'system', content: 'You are a helpful nutrition and grocery analytics AI. Always respond with valid JSON only, no markdown formatting.' },
            { role: 'user', content: prompt }
        ],
        temperature: 1,
        max_tokens: 8192,
        top_p: 0.95,
        extra_body: {
            "chat_template_kwargs": {
                "thinking": true
            }
        }
    });
    return completion.choices[0].message.content;
}

async function nvidiaGenerateVision(prompt, imageBase64, mimeType, apiKey) {
    const nvidia = new OpenAI({ 
        apiKey, 
        baseURL: 'https://integrate.api.nvidia.com/v1',
    });
    // Fallback vision model on Nvidia standard catalog, e.g., meta/llama-3.2-90b-vision-instruct
    const completion = await nvidia.chat.completions.create({
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
    });
    return completion.choices[0].message.content;
}

// ─── Public API ───

/**
 * Generate a text response with automatic provider fallback.
 * Chain: Gemini → OpenAI → Nvidia → throw
 * Returns { text, provider }
 */
export async function generateText(prompt) {
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const nvidiaKey = process.env.NVIDIA_API_KEY;
    const errors = [];

    // 1. Try Gemini
    if (geminiKey) {
        try {
            const text = await geminiGenerateText(prompt, geminiKey);
            return { text, provider: PROVIDERS.GEMINI };
        } catch (err) {
            errors.push(`Gemini: ${err.message}`);
            if (!isQuotaError(err)) {
                console.warn('Gemini non-quota error, falling back:', err.message);
            }
        }
    }

    // 2. Try OpenAI
    if (openaiKey) {
        try {
            const text = await openaiGenerateText(prompt, openaiKey);
            return { text, provider: PROVIDERS.OPENAI };
        } catch (err) {
            errors.push(`OpenAI: ${err.message}`);
            console.warn('OpenAI error, falling back to Nvidia:', err.message);
        }
    }

    // 3. Try Nvidia
    if (nvidiaKey) {
        try {
            const text = await nvidiaGenerateText(prompt, nvidiaKey);
            return { text, provider: PROVIDERS.NVIDIA };
        } catch (err) {
            errors.push(`Nvidia: ${err.message}`);
            console.warn('Nvidia error:', err.message);
        }
    } else {
        errors.push('Nvidia: No API key configured');
    }

    // 4. None available
    throw new Error(
        `All AI providers failed. ${errors.join(' | ')}${!geminiKey && !openaiKey && !nvidiaKey ? ' No API keys configured — add GEMINI_API_KEY, OPENAI_API_KEY, or NVIDIA_API_KEY to .env.local.' : ''}`
    );
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
 * Chain: Gemini → OpenAI → Nvidia → throw
 * Returns { text, provider }
 */
export async function generateVision(prompt, imageBase64, mimeType) {
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const nvidiaKey = process.env.NVIDIA_API_KEY;
    const errors = [];

    // 1. Try Gemini
    if (geminiKey) {
        try {
            const text = await geminiGenerateVision(prompt, imageBase64, mimeType, geminiKey);
            return { text, provider: PROVIDERS.GEMINI };
        } catch (err) {
            errors.push(`Gemini: ${err.message}`);
            if (!isQuotaError(err)) {
                console.warn('Gemini vision non-quota error:', err.message);
            }
        }
    }

    // 2. Try OpenAI
    if (openaiKey) {
        try {
            const text = await openaiGenerateVision(prompt, imageBase64, mimeType, openaiKey);
            return { text, provider: PROVIDERS.OPENAI };
        } catch (err) {
            errors.push(`OpenAI: ${err.message}`);
            console.warn('OpenAI vision error:', err.message);
        }
    }

    // 3. Try Nvidia vision
    if (nvidiaKey) {
        try {
            const text = await nvidiaGenerateVision(prompt, imageBase64, mimeType, nvidiaKey);
            return { text, provider: PROVIDERS.NVIDIA };
        } catch (err) {
            errors.push(`Nvidia: ${err.message}`);
            console.warn('Nvidia vision error:', err.message);
        }
    } else {
        errors.push('Nvidia: No API key configured');
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
            const nvidiaKey = process.env.NVIDIA_API_KEY;
            console.log('Nvidia vision returned text, structuring via text model...');
            try {
                if (nvidiaKey) {
                    const structureResponse = await nvidiaGenerateText(
                        `${prompt}\n\nHere is the text extracted from a receipt image:\n\n${text}\n\nBased on this extracted text, return ONLY valid JSON. No markdown, no explanations, no code fences.`,
                        nvidiaKey
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
