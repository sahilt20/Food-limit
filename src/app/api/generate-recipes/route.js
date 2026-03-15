import { NextResponse } from 'next/server';
import { generateJSON } from '@/lib/aiProvider';
import { checkRateLimit, rateLimitHeaders } from '@/lib/rateLimit';

export async function POST(request) {
  // Rate limit check
  const rl = checkRateLimit(request);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    const { ingredients = [], dietary = 'None', cuisine = 'Any' } = await request.json();

    if (!ingredients || ingredients.length === 0) {
      return NextResponse.json(
        { error: 'No ingredients provided' },
        { status: 400 }
      );
    }

    const maxItems = ingredients.slice(0, 50); // limit to recent 50 to save context

    const prompt = `You are a world-class culinary AI chef. Generate two delicious recipes based strictly on the user's available pantry ingredients and preferences. You can assume basic pantry staples (salt, pepper, oil, water) are available even if not listed.

User Preferences:
- Dietary Restrictions: ${dietary}
- Cuisine Type: ${cuisine}

Available Pantry Ingredients:
${JSON.stringify(maxItems)}

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

Only suggest recipes that heavily utilize the "Available Pantry Ingredients". It is okay to require 1 or 2 "missing_ingredients" if absolutely necessary, but prioritize relying entirely on what they have. 
If the dietary restriction contradicts the pantry items (e.g. Vegan but only has chicken), do your best to invent a recipe using only the compliant items or declare compliant missing_ingredients.

CRITICAL: Return ONLY valid JSON, no markdown formatting outside the JSON, no explanations.`;

    const { data, provider } = await generateJSON(prompt);

    return NextResponse.json(
      { data, provider },
      { headers: rateLimitHeaders(rl) }
    );
  } catch (error) {
    console.error('AI recipe generation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate recipes. Please try again.' },
      { status: 500, headers: rateLimitHeaders(rl) }
    );
  }
}
