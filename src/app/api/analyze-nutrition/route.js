import { NextResponse } from 'next/server';
import { generateJSON } from '@/lib/aiProvider';
import { lookupNutrition } from '@/lib/nutritionDB';
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

        const itemsList = items.map(i =>
            `- ${i.name} (${i.quantity} ${i.unit}, $${i.price || 0})`
        ).join('\n');

        const prompt = `You are a nutrition expert. Analyze these grocery items and provide detailed nutrition data.

CRITICAL INSTRUCTION: Calculate the TOTAL nutritional values scaled for the ENTIRE quantity and unit specified per item (e.g. if the item is "2 kg of chicken", provide the macros for 2 kg, not 100g).

Items:
${itemsList}

Provide a JSON response with this exact structure:
{
    "items": [
        {
            "name": "item name",
            "calories": 150,
            "protein_g": 10,
            "carbs_g": 20,
            "fat_g": 5,
            "fiber_g": 3,
            "sugar_g": 8,
            "sodium_mg": 200,
            "calcium_mg": 50,
            "iron_mg": 1.5,
            "potassium_mg": 300,
            "vitamin_a_mcg": 10,
            "vitamin_c_mg": 5,
            "vitamin_d_mcg": 0,
            "zinc_mg": 1,
            "magnesium_mg": 20,
            "health_score": 75,
            "category": "Protein"
        }
    ],
    "summary": {
        "total_calories": 1500,
        "total_protein": 80,
        "total_carbs": 200,
        "total_fat": 50,
        "overall_health_score": 72,
        "highlights": ["Good protein variety", "Consider more fiber"],
        "concerns": ["High sodium in processed items"]
    }
}

IMPORTANT: Return ONLY valid JSON. No markdown, no extra text.`;

        try {
            const { data, provider } = await generateJSON(prompt);
            return NextResponse.json(
                { data, provider },
                { headers: rateLimitHeaders(rl) }
            );
        } catch (aiError) {
            // AI failed — fall back to local nutrition DB
            console.warn('AI nutrition failed, using local DB:', aiError.message);

            const UNIT_TO_GRAMS = {
                g: 1, kg: 1000, piece: 150, oz: 28.35,
                lb: 453.6, cup: 240, ml: 1, L: 1000,
            };

            const localItems = items.map(item => {
                const gramsMultiplier = UNIT_TO_GRAMS[item.unit] || 100;
                const totalGrams = (item.quantity || 1) * gramsMultiplier;
                const nutrition = lookupNutrition(item.name, totalGrams);

                if (nutrition) {
                    return {
                        name: item.name,
                        calories: Math.round(nutrition.calories || 0),
                        protein_g: Math.round((nutrition.protein_g || 0) * 10) / 10,
                        carbs_g: Math.round((nutrition.carbs_g || 0) * 10) / 10,
                        fat_g: Math.round((nutrition.fat_g || 0) * 10) / 10,
                        fiber_g: Math.round((nutrition.fiber_g || 0) * 10) / 10,
                        sugar_g: Math.round((nutrition.sugar_g || 0) * 10) / 10,
                        sodium_mg: Math.round(nutrition.sodium_mg || 0),
                        health_score: nutrition.health_score || 70,
                        category: nutrition.category || item.category || 'Other',
                    };
                }
                return {
                    name: item.name,
                    calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0,
                    fiber_g: 0, sugar_g: 0, sodium_mg: 0,
                    calcium_mg: 0, iron_mg: 0, potassium_mg: 0,
                    vitamin_a_mcg: 0, vitamin_c_mg: 0, vitamin_d_mcg: 0,
                    zinc_mg: 0, magnesium_mg: 0,
                    health_score: 50,
                    category: item.category || 'Other',
                };
            });

            const totalCal = localItems.reduce((s, i) => s + i.calories, 0);
            const totalPro = localItems.reduce((s, i) => s + i.protein_g, 0);
            const totalCarbs = localItems.reduce((s, i) => s + i.carbs_g, 0);
            const totalFat = localItems.reduce((s, i) => s + i.fat_g, 0);

            return NextResponse.json({
                data: {
                    items: localItems,
                    summary: {
                        total_calories: totalCal,
                        total_protein: totalPro,
                        total_carbs: totalCarbs,
                        total_fat: totalFat,
                        overall_health_score: Math.round(
                            localItems.reduce((s, i) => s + i.health_score, 0) / (localItems.length || 1)
                        ),
                        highlights: ['Data from local nutritionDB (AI unavailable)'],
                        concerns: [],
                    },
                },
                provider: 'local',
                warning: aiError.message,
            }, { headers: rateLimitHeaders(rl) });
        }
    } catch (error) {
        console.error('Nutrition analysis error:', error);
        return NextResponse.json(
            { error: error.message || 'Nutrition analysis failed' },
            { status: 500 }
        );
    }
}
