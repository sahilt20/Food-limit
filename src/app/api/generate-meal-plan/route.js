import { NextResponse } from 'next/server';
import { generateJSON } from '@/lib/aiProvider';
import { checkRateLimit, rateLimitHeaders } from '@/lib/rateLimit';
import { sanitizeString, validateDietary, validatePositiveInt, generateRequestId } from '@/lib/validation';

const MAX_PANTRY_ITEMS = 50;

export async function POST(request) {
    const requestId = generateRequestId();
    const rl = checkRateLimit(request, 'generate-meal-plan');

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

        const { pantryItems, dietary, days, calorieTarget, familySize } = body;

        if (!Array.isArray(pantryItems) || pantryItems.length === 0) {
            return NextResponse.json(
                { error: 'No pantry items provided', requestId },
                { status: 400, headers: rateLimitHeaders(rl) }
            );
        }

        // Sanitize inputs
        const safePantry = pantryItems
            .slice(0, MAX_PANTRY_ITEMS)
            .map(i => sanitizeString(typeof i === 'string' ? i : String(i)))
            .filter(Boolean);

        const safeDietary     = validateDietary(dietary);
        const safeDays        = validatePositiveInt(days, 1, 14, 3);
        const safeCalories    = validatePositiveInt(calorieTarget, 500, 10000, 2000);
        const safeFamilySize  = validatePositiveInt(familySize, 1, 20, 1);

        const prompt = `You are a nutritionist meal planner. Create a ${safeDays}-day meal plan using these available ingredients.

Available Ingredients: ${safePantry.join(', ')}
Dietary: ${safeDietary}
Daily Calorie Target: ${safeCalories} kcal (for ${safeFamilySize} person${safeFamilySize > 1 ? 's' : ''})
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
        return NextResponse.json(
            { data, provider, requestId },
            { headers: rateLimitHeaders(rl) }
        );
    } catch (error) {
        console.error(`[${requestId}] Meal plan generation error:`, error);
        return NextResponse.json(
            { error: 'Failed to generate meal plan', requestId },
            { status: 500, headers: rateLimitHeaders(rl) }
        );
    }
}
