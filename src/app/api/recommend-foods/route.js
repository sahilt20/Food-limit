import { NextResponse } from 'next/server';
import { generateJSON } from '@/lib/aiProvider';
import { checkRateLimit, rateLimitHeaders } from '@/lib/rateLimit';

export async function POST(request) {
    const rl = checkRateLimit(request);
    if (!rl.allowed) {
        return NextResponse.json(
            { error: 'Too many requests. Please try again later.' },
            { status: 429, headers: rateLimitHeaders(rl) }
        );
    }

    try {
        const { items } = await request.json();

        if (!items || items.length === 0) {
            return NextResponse.json(
                { error: 'No items provided' },
                { status: 400 }
            );
        }

        const itemsList = items.map(i => `- ${i.name} (${i.category || 'Other'})`).join('\n');

        const prompt = `You are a nutrition and health expert. For each grocery item below, suggest a HEALTHIER alternative that is:
- More nutritious
- Similar in use/purpose
- Reasonably priced

Items:
${itemsList}

Return a JSON object:
{
    "recommendations": [
        {
            "original": "White Rice",
            "alternative": "Brown Rice",
            "reason": "Higher fiber and more micronutrients",
            "nutrition_improvement": "+3g fiber, +2g protein per serving",
            "price_comparison": "Similar price"
        }
    ]
}

IMPORTANT: Return ONLY valid JSON. No markdown, no extra text.`;

        try {
            const { data, provider } = await generateJSON(prompt);
            return NextResponse.json(
                { data, provider },
                { headers: rateLimitHeaders(rl) }
            );
        } catch (aiError) {
            // Fallback: return generic recommendations
            const fallbackRecs = items.map(item => ({
                original: item.name,
                alternative: `Organic ${item.name}`,
                reason: 'AI recommendations unavailable — try again later or add an OpenAI API key as fallback',
                nutrition_improvement: 'N/A',
                price_comparison: 'Varies',
            }));

            return NextResponse.json({
                data: { recommendations: fallbackRecs },
                provider: 'local',
                warning: aiError.message,
            }, { headers: rateLimitHeaders(rl) });
        }
    } catch (error) {
        console.error('Recommendation error:', error);
        return NextResponse.json(
            { error: error.message || 'Recommendation failed' },
            { status: 500 }
        );
    }
}
