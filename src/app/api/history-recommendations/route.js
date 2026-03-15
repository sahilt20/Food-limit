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
        const { topItems, recentItems } = await request.json();

        if (!topItems || topItems.length === 0) {
            return NextResponse.json(
                { error: 'No purchase history provided.' },
                { status: 400 }
            );
        }

        const prompt = `You are a world-class nutrition and culinary expert AI. 
Analyze the user's grocery purchase history to provide highly personalized recommendations that "complement or improve" their food.

Context:
User's Most Frequently Bought Items: 
${JSON.stringify(topItems.slice(0, 30))}

User's Recent Purchases (for context):
${JSON.stringify(recentItems?.slice(0, 20) || [])}

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
1. Provide 3-5 high-quality "complements" (foods to add alongside what they already eat).
2. Provide 3-5 "improvements" (healthy swaps for lower-quality items they frequently buy).
3. Identify 1-3 likely "nutritional_gaps" based on the ABSENCE of certain food groups.
4. Output STRICTLY JSON.
5. Provide a realistic "suggested_store" (e.g., Whole Foods, Trader Joe's, Walmart, Aldi, Local Farmers Market) for EVERY item recommended where the user is likely to find high-quality versions of that food.`;

        try {
            const { data, provider } = await generateJSON(prompt);
            return NextResponse.json(
                { data, provider },
                { headers: rateLimitHeaders(rl) }
            );
        } catch (aiError) {
            console.error('AI History Recommendations Error:', aiError);
            return NextResponse.json({
                error: 'AI is temporarily unavailable. Please try again later.'
            }, { status: 503, headers: rateLimitHeaders(rl) });
        }
    } catch (error) {
        console.error('History recommendation route error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to generate recommendations.' },
            { status: 500 }
        );
    }
}
