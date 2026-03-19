import { NextResponse } from 'next/server';
import { generateJSON } from '@/lib/aiProvider';
import { checkRateLimit, rateLimitHeaders } from '@/lib/rateLimit';
import { sanitizeString, generateRequestId } from '@/lib/validation';

const MAX_TOP_ITEMS    = 30;
const MAX_RECENT_ITEMS = 20;

export async function POST(request) {
    const requestId = generateRequestId();
    const rl = checkRateLimit(request, 'history-recommendations');

    if (!rl.allowed) {
        return NextResponse.json(
            { error: 'Too many requests. Please try again later.', requestId },
            { status: 429, headers: rateLimitHeaders(rl) }
        );
    }

    try {
        let body;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                { error: 'Invalid JSON body', requestId },
                { status: 400, headers: rateLimitHeaders(rl) }
            );
        }

        const { topItems, recentItems } = body;

        if (!Array.isArray(topItems) || topItems.length === 0) {
            return NextResponse.json(
                { error: 'No purchase history provided.', requestId },
                { status: 400, headers: rateLimitHeaders(rl) }
            );
        }

        // Sanitize item names (these come from user purchase history)
        const safeTopItems = topItems
            .slice(0, MAX_TOP_ITEMS)
            .map(i => (typeof i === 'string' ? sanitizeString(i) : sanitizeString(String(i?.name ?? ''))))
            .filter(Boolean);

        const safeRecentItems = (Array.isArray(recentItems) ? recentItems : [])
            .slice(0, MAX_RECENT_ITEMS)
            .map(i => (typeof i === 'string' ? sanitizeString(i) : sanitizeString(String(i?.name ?? ''))))
            .filter(Boolean);

        const prompt = `You are a world-class nutrition and culinary expert AI.
Analyze the user's grocery purchase history to provide highly personalized recommendations that "complement or improve" their food.

Context:
User's Most Frequently Bought Items:
${JSON.stringify(safeTopItems)}

User's Recent Purchases (for context):
${JSON.stringify(safeRecentItems)}

Provide your response in EXACTLY this JSON format:
{
    "complements": [
        {
            "item_to_add": "Fresh Spinach",
            "because_you_buy": "Eggs",
            "reason": "Adding a handful of spinach to your eggs introduces crucial iron, folate, and fiber to your morning routine seamlessly.",
            "suggested_store": "Local Farmers Market or Whole Foods"
        }
    ],
    "improvements": [
        {
            "original_item": "White Bread",
            "better_alternative": "Sourdough or Sprouted Whole Wheat",
            "reason": "Significantly lowers the glycemic spike and provides healthy gut bacteria (if sourdough).",
            "suggested_store": "Local Bakery or Trader Joe's"
        }
    ],
    "nutritional_gaps": [
        {
            "missing_nutrient": "Omega-3 Fatty Acids",
            "suggestion": "Chia seeds, Flaxseeds, or Mackerel",
            "reason": "Your purchase history shows very few sources of Omega-3s.",
            "suggested_store": "Sprouts or Target Grocery"
        }
    ],
    "overall_advice": "A short, encouraging 2-sentence summary of how they can elevate their current diet."
}

CRITICAL RULES:
1. Provide 3-5 high-quality "complements".
2. Provide 3-5 "improvements" (healthy swaps for lower-quality items).
3. Identify 1-3 likely "nutritional_gaps" based on the ABSENCE of certain food groups.
4. Output STRICTLY JSON.
5. Provide a realistic "suggested_store" for every item.`;

        try {
            const { data, provider } = await generateJSON(prompt);
            return NextResponse.json(
                { data, provider, requestId },
                { headers: rateLimitHeaders(rl) }
            );
        } catch (aiError) {
            console.warn(`[${requestId}] AI history recommendations failed:`, aiError.message);
            return NextResponse.json(
                { error: 'AI is temporarily unavailable. Please try again later.', requestId },
                { status: 503, headers: rateLimitHeaders(rl) }
            );
        }
    } catch (error) {
        console.error(`[${requestId}] History recommendation error:`, error);
        return NextResponse.json(
            { error: 'Failed to generate recommendations.', requestId },
            { status: 500, headers: rateLimitHeaders(rl) }
        );
    }
}
