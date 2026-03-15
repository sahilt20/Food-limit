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
        const { pantryItems, dietary, days = 3, calorieTarget = 2000, familySize = 1 } = await request.json();

        if (!pantryItems || pantryItems.length === 0) {
            return NextResponse.json({ error: 'No pantry items provided' }, { status: 400 });
        }

        const prompt = `You are a nutritionist meal planner. Create a ${days}-day meal plan using these available ingredients.

Available Ingredients: ${pantryItems.slice(0, 30).join(', ')}
Dietary: ${dietary || 'None'}
Daily Calorie Target: ${calorieTarget} kcal (for ${familySize} person${familySize > 1 ? 's' : ''})
Basic staples (salt, pepper, oil, water, spices) are available.

Return ONLY this JSON:
{
    "meal_plan": [
        {
            "day": 1,
            "meals": {
                "breakfast": { "name": "Meal name", "ingredients": ["item1"], "calories": 400, "protein_g": 15, "prep_mins": 15 },
                "lunch": { "name": "Meal name", "ingredients": ["item1"], "calories": 500, "protein_g": 25, "prep_mins": 20 },
                "dinner": { "name": "Meal name", "ingredients": ["item1"], "calories": 600, "protein_g": 30, "prep_mins": 30 },
                "snack": { "name": "Snack name", "ingredients": ["item1"], "calories": 200, "protein_g": 5, "prep_mins": 5 }
            },
            "day_total_calories": 1700,
            "day_total_protein_g": 75
        }
    ],
    "shopping_list": ["items not in pantry but needed"],
    "weekly_summary": {
        "avg_daily_calories": 1800,
        "avg_daily_protein_g": 70,
        "estimated_cost_savings": "Using pantry items saves approx $X",
        "nutrition_balance": "Good/Fair/Poor",
        "tips": ["Tip 1", "Tip 2"]
    }
}`;

        const { data, provider } = await generateJSON(prompt);
        return NextResponse.json({ data, provider }, { headers: rateLimitHeaders(rl) });
    } catch (error) {
        console.error('Meal plan generation error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to generate meal plan' },
            { status: 500, headers: rateLimitHeaders(rl) }
        );
    }
}
