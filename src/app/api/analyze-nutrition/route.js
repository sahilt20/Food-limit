import { NextResponse } from 'next/server';
import { generateJSON } from '@/lib/aiProvider';
import { lookupNutrition } from '@/lib/nutritionDB';
import { checkRateLimit, rateLimitHeaders } from '@/lib/rateLimit';
import { validateItems, generateRequestId } from '@/lib/validation';

export async function POST(request) {
    const requestId = generateRequestId();
    const rl = checkRateLimit(request, 'analyze-nutrition');

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

        const validation = validateItems(body?.items);
        if (!validation.valid) {
            return NextResponse.json(
                { error: validation.errors[0] ?? 'Invalid items', requestId },
                { status: 400, headers: rateLimitHeaders(rl) }
            );
        }

        const { items } = validation;

        const itemsList = items.map(i =>
            `- ${i.name} (${i.quantity} ${i.unit}, $${i.price})`
        ).join('\n');

        const prompt = `You are a nutrition expert. Analyze these grocery items and provide detailed nutrition data.

CRITICAL: Calculate TOTAL nutritional values scaled for the ENTIRE quantity per item (e.g. "2 kg chicken" = nutrients for 2000g, not 100g).

Items:
${itemsList}

Return ONLY this JSON structure (no markdown, no extra text):
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
        "total_protein_g": 80,
        "total_carbs_g": 200,
        "total_fat_g": 50,
        "total_sugar_g": 30,
        "total_salt_g": 2.5,
        "overall_health_score": 72,
        "diet_assessment": "Balanced diet with good protein sources",
        "highlights": ["Good protein variety", "Consider more fiber"],
        "concerns": ["High sodium in processed items"]
    }
}`;

        try {
            const { data, provider } = await generateJSON(prompt);
            return NextResponse.json(
                { data, provider, requestId },
                { headers: rateLimitHeaders(rl) }
            );
        } catch (aiError) {
            // AI failed — fall back to local nutrition DB
            console.warn(`[${requestId}] AI nutrition failed, using local DB:`, aiError.message);

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
                        calcium_mg: Math.round(nutrition.calcium_mg || 0),
                        iron_mg: Math.round((nutrition.iron_mg || 0) * 10) / 10,
                        potassium_mg: Math.round(nutrition.potassium_mg || 0),
                        vitamin_a_mcg: Math.round((nutrition.vitamin_a_mcg || 0) * 10) / 10,
                        vitamin_c_mg: Math.round((nutrition.vitamin_c_mg || 0) * 10) / 10,
                        vitamin_d_mcg: Math.round((nutrition.vitamin_d_mcg || 0) * 10) / 10,
                        zinc_mg: Math.round((nutrition.zinc_mg || 0) * 10) / 10,
                        magnesium_mg: Math.round((nutrition.magnesium_mg || 0) * 10) / 10,
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

            const totalCal   = localItems.reduce((s, i) => s + i.calories, 0);
            const totalPro   = localItems.reduce((s, i) => s + i.protein_g, 0);
            const totalCarbs = localItems.reduce((s, i) => s + i.carbs_g, 0);
            const totalFat   = localItems.reduce((s, i) => s + i.fat_g, 0);
            const totalSugar = localItems.reduce((s, i) => s + i.sugar_g, 0);
            const totalSodium = localItems.reduce((s, i) => s + i.sodium_mg, 0);

            return NextResponse.json({
                data: {
                    items: localItems,
                    summary: {
                        total_calories: totalCal,
                        total_protein_g: totalPro,
                        total_carbs_g: totalCarbs,
                        total_fat_g: totalFat,
                        total_sugar_g: totalSugar,
                        total_salt_g: Math.round((totalSodium * 2.5 / 1000) * 10) / 10,
                        overall_health_score: Math.round(
                            localItems.reduce((s, i) => s + i.health_score, 0) / (localItems.length || 1)
                        ),
                        diet_assessment: 'Nutrition data from local database',
                        highlights: ['Data from local nutritionDB (AI unavailable)'],
                        concerns: [],
                    },
                },
                provider: 'local',
                warning: 'AI unavailable; used local database',
                requestId,
            }, { headers: rateLimitHeaders(rl) });
        }
    } catch (error) {
        console.error(`[${requestId}] Nutrition analysis error:`, error);
        return NextResponse.json(
            { error: 'Nutrition analysis failed', requestId },
            { status: 500, headers: rateLimitHeaders(rl) }
        );
    }
}
