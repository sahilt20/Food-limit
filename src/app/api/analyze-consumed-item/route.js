import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';
import { generateJSON, generateVisionJSON } from '@/lib/aiProvider';
import { lookupNutrition } from '@/lib/nutritionDB';
import { checkRateLimit, rateLimitHeaders } from '@/lib/rateLimit';
import {
    generateRequestId,
    sanitizeString,
    sanitizeBarcode,
    validateMealType,
    validatePositiveNumber,
    validateUploadedFile,
    validateNutritionPayload,
} from '@/lib/validation';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const UNIT_TO_GRAMS = {
    g: 1,
    kg: 1000,
    mg: 0.001,
    oz: 28.35,
    lb: 453.6,
    ml: 1,
    L: 1000,
    piece: 150,
    serving: 100,
};

function buildFallback(itemName, brand, barcode, quantity, servingSize, servingUnit) {
    const totalGrams = quantity * servingSize * (UNIT_TO_GRAMS[servingUnit] || 1);
    const nutrition = lookupNutrition(itemName, totalGrams);

    const cleanNutrition = validateNutritionPayload(nutrition || {});

    return {
        item: {
            name: itemName,
            brand,
            description: nutrition
                ? `Estimated nutrition for ${quantity} ${quantity === 1 ? 'serving' : 'servings'} of ${itemName}.`
                : `No packaged-food match found. Saved as a manual estimate for ${itemName}.`,
            barcode,
            category: nutrition?.category || 'Other',
            quantity,
            serving_size: servingSize,
            serving_unit: servingUnit,
            meal_type: 'snack',
            confidence: nutrition ? 'medium' : 'low',
        },
        nutrition: cleanNutrition,
        note: nutrition
            ? 'Used local nutrition data as a fallback.'
            : 'No exact match was found. Nutrition defaults to zero until edited or rescanned.',
    };
}

function scaleNutrition(nutrition, ratio) {
    const scaled = {};
    for (const [key, value] of Object.entries(validateNutritionPayload(nutrition))) {
        scaled[key] = Number((value * ratio).toFixed(2));
    }
    return scaled;
}

async function findExistingBarcodeMatch(barcode, quantity, servingSize) {
    if (!barcode) return null;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('consumed_items')
        .select(`
            id,
            name,
            brand,
            description,
            barcode,
            category,
            meal_type,
            quantity,
            serving_size,
            serving_unit,
            confidence,
            ai_provider,
            consumed_item_nutrition (*)
        `)
        .eq('user_id', user.id)
        .eq('barcode', barcode)
        .not('barcode', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error || !data) return null;

    const nutritionRow = Array.isArray(data.consumed_item_nutrition)
        ? data.consumed_item_nutrition[0]
        : data.consumed_item_nutrition;
    if (!nutritionRow) return null;

    const originalQuantity = Number(data.quantity || 1);
    const originalServingSize = Number(data.serving_size || 1);
    const totalOriginalAmount = Math.max(0.1, originalQuantity * originalServingSize);
    const totalRequestedAmount = Math.max(0.1, quantity * servingSize);
    const ratio = totalRequestedAmount / totalOriginalAmount;

    return {
        item: {
            name: data.name,
            brand: data.brand || '',
            description: data.description || `Reused saved product for barcode ${barcode}.`,
            barcode: data.barcode,
            category: data.category || 'Other',
            quantity,
            serving_size: servingSize,
            serving_unit: data.serving_unit || 'serving',
            meal_type: data.meal_type || 'snack',
            confidence: data.confidence || 'high',
        },
        nutrition: scaleNutrition(nutritionRow, ratio),
        note: 'Reused a previously saved barcode match from your intake history.',
        provider: data.ai_provider || 'saved',
        reused: true,
    };
}

async function parsePayload(request) {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
        const formData = await request.formData();
        const image = formData.get('label_image');
        return {
            isMultipart: true,
            image,
            itemName: sanitizeString(formData.get('itemName') || ''),
            brand: sanitizeString(formData.get('brand') || '', 120),
            barcode: sanitizeBarcode(formData.get('barcode') || ''),
            mealType: validateMealType(formData.get('mealType')),
            quantity: validatePositiveNumber(formData.get('quantity'), 0.1, 20, 1),
            servingSize: validatePositiveNumber(formData.get('servingSize'), 0.1, 5000, 1),
            servingUnit: sanitizeString(formData.get('servingUnit') || 'serving', 30) || 'serving',
            notes: sanitizeString(formData.get('notes') || '', 300),
        };
    }

    const body = await request.json();
    return {
        isMultipart: false,
        image: null,
        itemName: sanitizeString(body?.itemName || ''),
        brand: sanitizeString(body?.brand || '', 120),
        barcode: sanitizeBarcode(body?.barcode || ''),
        mealType: validateMealType(body?.mealType),
        quantity: validatePositiveNumber(body?.quantity, 0.1, 20, 1),
        servingSize: validatePositiveNumber(body?.servingSize, 0.1, 5000, 1),
        servingUnit: sanitizeString(body?.servingUnit || 'serving', 30) || 'serving',
        notes: sanitizeString(body?.notes || '', 300),
    };
}

function buildPrompt({ itemName, brand, barcode, mealType, quantity, servingSize, servingUnit, notes }, hasImage) {
    return `You are a packaged-food nutrition analyst.

Your job:
1. Identify the consumed product from the label image and/or barcode details.
2. Return a short human-readable description.
3. Estimate TOTAL nutrition for the amount actually consumed.
4. Be conservative and realistic. If confidence is low, say so.

Consumed amount:
- Quantity eaten: ${quantity}
- Serving size: ${servingSize} ${servingUnit}
- Meal type: ${mealType}

Known details:
- Product name hint: ${itemName || 'unknown'}
- Brand hint: ${brand || 'unknown'}
- Barcode: ${barcode || 'not provided'}
- Notes: ${notes || 'none'}
- Has label image: ${hasImage ? 'yes' : 'no'}

Return ONLY valid JSON:
{
  "item": {
    "name": "Product name",
    "brand": "Brand name",
    "description": "Short description of the consumed product",
    "barcode": "${barcode || ''}",
    "category": "Other",
    "quantity": ${quantity},
    "serving_size": ${servingSize},
    "serving_unit": "${servingUnit}",
    "meal_type": "${mealType}",
    "confidence": "high"
  },
  "nutrition": {
    "calories": 0,
    "protein_g": 0,
    "carbs_g": 0,
    "fat_g": 0,
    "fiber_g": 0,
    "sugar_g": 0,
    "sodium_mg": 0,
    "potassium_mg": 0,
    "calcium_mg": 0,
    "iron_mg": 0,
    "vitamin_a_mcg": 0,
    "vitamin_c_mg": 0,
    "vitamin_d_mcg": 0,
    "vitamin_b12_mcg": 0,
    "vitamin_e_mg": 0,
    "vitamin_k_mcg": 0,
    "zinc_mg": 0,
    "magnesium_mg": 0,
    "folate_mcg": 0,
    "omega_3_mg": 0
  },
  "note": "One short sentence about confidence or assumptions"
}

Rules:
- Nutrition must be TOTAL for the consumed amount, not per 100g.
- Use the image text if available. Barcode alone is not enough unless you are confident.
- If exact packaged data is unclear, infer the closest reasonable product and lower the confidence.
- Category must be one of: Fruits, Vegetables, Protein, Dairy, Grains, Legumes, Oils, Snacks, Beverages, Spices, Other.`;
}

export async function POST(request) {
    const requestId = generateRequestId();
    const rl = checkRateLimit(request, 'analyze-consumed-item');

    if (!rl.allowed) {
        return NextResponse.json(
            { error: 'Too many requests. Please try again later.', requestId },
            { status: 429, headers: rateLimitHeaders(rl) }
        );
    }

    try {
        const payload = await parsePayload(request);
        const {
            image,
            itemName,
            brand,
            barcode,
            mealType,
            quantity,
            servingSize,
            servingUnit,
            notes,
        } = payload;

        if (!itemName && !image && !barcode) {
            return NextResponse.json(
                { error: 'Provide a product name, barcode, or label image.', requestId },
                { status: 400, headers: rateLimitHeaders(rl) }
            );
        }

        if (image) {
            const validation = validateUploadedFile(image, ALLOWED_MIME_TYPES, MAX_FILE_SIZE);
            if (!validation.valid) {
                return NextResponse.json(
                    { error: validation.error, requestId },
                    { status: 400, headers: rateLimitHeaders(rl) }
                );
            }
        }

        const existingMatch = await findExistingBarcodeMatch(barcode, quantity, servingSize);
        if (existingMatch) {
            return NextResponse.json(
                {
                    data: {
                        item: {
                            ...existingMatch.item,
                            meal_type: validateMealType(existingMatch.item.meal_type || mealType),
                        },
                        nutrition: validateNutritionPayload(existingMatch.nutrition),
                        note: existingMatch.note,
                    },
                    provider: existingMatch.provider,
                    reused: true,
                    requestId,
                },
                { headers: rateLimitHeaders(rl) }
            );
        }

        const prompt = buildPrompt({
            itemName,
            brand,
            barcode,
            mealType,
            quantity,
            servingSize,
            servingUnit,
            notes,
        }, Boolean(image));

        try {
            if (image) {
                const bytes = await image.arrayBuffer();
                const buffer = Buffer.from(bytes);
                const base64 = buffer.toString('base64');
                const mimeType = image.type || 'image/jpeg';
                const { data, provider } = await generateVisionJSON(prompt, base64, mimeType);
                return NextResponse.json(
                    {
                        data: {
                            ...data,
                            item: {
                                ...data.item,
                                barcode: data?.item?.barcode || barcode,
                                meal_type: validateMealType(data?.item?.meal_type || mealType),
                            },
                            nutrition: validateNutritionPayload(data?.nutrition),
                        },
                        provider,
                        requestId,
                    },
                    { headers: rateLimitHeaders(rl) }
                );
            }

            const { data, provider } = await generateJSON(prompt);
            return NextResponse.json(
                {
                    data: {
                        ...data,
                        item: {
                            ...data.item,
                            barcode: data?.item?.barcode || barcode,
                            meal_type: validateMealType(data?.item?.meal_type || mealType),
                        },
                        nutrition: validateNutritionPayload(data?.nutrition),
                    },
                    provider,
                    requestId,
                },
                { headers: rateLimitHeaders(rl) }
            );
        } catch (aiError) {
            console.warn(`[${requestId}] Consumed item AI analysis failed:`, aiError.message);

            const fallback = buildFallback(
                itemName || brand || 'Unknown item',
                brand,
                barcode,
                quantity,
                servingSize,
                servingUnit
            );

            return NextResponse.json(
                {
                    data: fallback,
                    provider: 'local',
                    warning: 'AI unavailable. Used local nutrition fallback.',
                    requestId,
                },
                { headers: rateLimitHeaders(rl) }
            );
        }
    } catch (error) {
        console.error(`[${requestId}] Consumed item analysis error:`, error);
        return NextResponse.json(
            { error: 'Failed to analyze consumed item', requestId },
            { status: 500, headers: rateLimitHeaders(rl) }
        );
    }
}
