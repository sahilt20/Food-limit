import { NextResponse } from 'next/server';
import { generateJSON } from '@/lib/aiProvider';
import { checkRateLimit, rateLimitHeaders } from '@/lib/rateLimit';
import { sanitizeString, validateDietary, generateRequestId } from '@/lib/validation';

const MAX_INGREDIENTS = 50;

export async function POST(request) {
    const requestId = generateRequestId();
    const rl = checkRateLimit(request, 'generate-recipes');

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

        const { ingredients = [], dietary, cuisine } = body;

        if (!Array.isArray(ingredients) || ingredients.length === 0) {
            return NextResponse.json(
                { error: 'No ingredients provided', requestId },
                { status: 400, headers: rateLimitHeaders(rl) }
            );
        }

        // Sanitize inputs
        const safeIngredients = ingredients
            .slice(0, MAX_INGREDIENTS)
            .map(i => (typeof i === 'string' ? sanitizeString(i) : sanitizeString(String(i))))
            .filter(Boolean);

        const safeDietary = validateDietary(dietary);
        const safeCuisine = sanitizeString(cuisine ?? 'Any', 50) || 'Any';

        const prompt = `You are a world-class culinary AI chef. Generate two delicious recipes based strictly on the user's available pantry ingredients and preferences. You can assume basic pantry staples (salt, pepper, oil, water) are available even if not listed.

User Preferences:
- Dietary Restrictions: ${safeDietary}
- Cuisine Type: ${safeCuisine}

Available Pantry Ingredients:
${JSON.stringify(safeIngredients)}

Provide a single JSON response exactly matching this structure:
{
    "recipes": [
        {
            "title": "Recipe Name",
            "description": "Short culinary description.",
            "prep_time_mins": 15,
            "cook_time_mins": 20,
            "difficulty": "Easy",
            "matched_ingredients": ["Item 1 from pantry", "Item 2 from pantry"],
            "missing_ingredients": ["Item they need to buy"],
            "instructions": [
                "Step 1: Prep...",
                "Step 2: Cook..."
            ],
            "nutrition_estimates": {
                "calories": 400,
                "protein_g": 20
            }
        }
    ]
}

Only suggest recipes that heavily utilize the "Available Pantry Ingredients". It is okay to require 1 or 2 "missing_ingredients" if absolutely necessary.
If the dietary restriction contradicts the pantry items (e.g. Vegan but only has chicken), invent a recipe using only the compliant items or declare compliant missing_ingredients.

CRITICAL: Return ONLY valid JSON, no markdown formatting outside the JSON, no explanations.`;

        const { data, provider } = await generateJSON(prompt);
        return NextResponse.json(
            { data, provider, requestId },
            { headers: rateLimitHeaders(rl) }
        );
    } catch (error) {
        console.error(`[${requestId}] Recipe generation error:`, error);
        return NextResponse.json(
            { error: error.message || 'Failed to generate recipes. Please try again.', requestId },
            { status: 500, headers: rateLimitHeaders(rl) }
        );
    }
}
