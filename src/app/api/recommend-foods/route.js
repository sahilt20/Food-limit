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
        const { items, storeName } = await request.json();

        if (!items || items.length === 0) {
            return NextResponse.json(
                { error: 'No items provided' },
                { status: 400 }
            );
        }

        const itemsList = items.map(i => `- ${i.name} (${i.category || 'Other'}, $${i.price || 0})`).join('\n');
        const storeContext = storeName ? `The user is currently shopping at ${storeName}. ` : '';

        const prompt = `You are a world-class nutrition and grocery shopping expert. ${storeContext}For each grocery item below, suggest HEALTHIER alternatives. 
You must provide multiple recommendations per item:
1. "same_store_alternative": An alternative likely found in the SAME store (e.g. if they are at Whole Foods, suggest a Whole Foods brand or organic equivalent). If no store is known, suggest a widely available brand.
2. "best_health_alternative": The absolute healthiest alternative regardless of store.

Items:
${itemsList}

Return a valid JSON object matching this schema exactly:
{
    "recommendations": [
        {
            "original_item": "White Rice",
            "same_store_alternative": {
                "name": "Brown Rice (Store Brand)",
                "reason": "Higher fiber, likely available where you are shopping",
                "price_impact": "Similar price"
            },
            "best_health_alternative": {
                "name": "Quinoa / Cauliflower Rice",
                "reason": "Significantly higher protein and lower glycemic index",
                "price_impact": "Slightly more expensive"
            }
        }
    ]
}`;

        try {
            const { data, provider } = await generateJSON(prompt);
            return NextResponse.json(
                { data, provider },
                { headers: rateLimitHeaders(rl) }
            );
        } catch (aiError) {
            // Fallback: return generic recommendations matching the new schema
            const fallbackRecs = items.map(item => ({
                original_item: item.name,
                same_store_alternative: {
                    name: `Store Brand ${item.name}`,
                    reason: 'AI unavailable — try again later or add an OpenAI/DeepSeek key',
                    price_impact: 'Usually cheaper',
                },
                best_health_alternative: {
                    name: `Organic ${item.name}`,
                    reason: 'Usually fewer pesticides/healthier soil processing',
                    price_impact: 'Varies',
                }
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
