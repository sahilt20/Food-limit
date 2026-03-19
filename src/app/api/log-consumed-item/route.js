import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';
import { checkRateLimit, rateLimitHeaders } from '@/lib/rateLimit';
import {
    generateRequestId,
    sanitizeString,
    sanitizeBarcode,
    validateMealType,
    validateNutritionPayload,
    validatePositiveNumber,
} from '@/lib/validation';

export async function POST(request) {
    const requestId = generateRequestId();
    const rl = checkRateLimit(request, 'log-consumed-item');

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

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json(
                { error: 'Not authenticated', requestId },
                { status: 401, headers: rateLimitHeaders(rl) }
            );
        }

        const item = body?.item || {};
        const itemId = typeof body?.itemId === 'string' ? body.itemId : '';
        const nutrition = validateNutritionPayload(body?.nutrition);
        const consumedOn = typeof body?.consumedOn === 'string' && body.consumedOn
            ? body.consumedOn
            : new Date().toISOString().slice(0, 10);

        const payload = {
            user_id: user.id,
            consumed_on: consumedOn,
            meal_type: validateMealType(item.meal_type),
            name: sanitizeString(item.name, 140),
            brand: sanitizeString(item.brand || '', 120),
            description: sanitizeString(item.description || '', 300),
            barcode: sanitizeBarcode(item.barcode || ''),
            quantity: validatePositiveNumber(item.quantity, 0.1, 20, 1),
            serving_size: validatePositiveNumber(item.serving_size, 0.1, 5000, 1),
            serving_unit: sanitizeString(item.serving_unit || 'serving', 30) || 'serving',
            category: sanitizeString(item.category || 'Other', 40) || 'Other',
            source: sanitizeString(item.source || 'manual', 40) || 'manual',
            ai_provider: sanitizeString(body?.provider || '', 40),
            confidence: sanitizeString(item.confidence || '', 20),
            notes: sanitizeString(item.notes || body?.notes || '', 500),
        };

        if (!payload.name) {
            return NextResponse.json(
                { error: 'Item name is required.', requestId },
                { status: 400, headers: rateLimitHeaders(rl) }
            );
        }

        let consumedItem = null;
        let itemError = null;

        if (itemId) {
            const updateResult = await supabase
                .from('consumed_items')
                .update(payload)
                .eq('id', itemId)
                .eq('user_id', user.id)
                .select('*')
                .single();
            consumedItem = updateResult.data;
            itemError = updateResult.error;
        } else {
            const insertResult = await supabase
                .from('consumed_items')
                .insert(payload)
                .select('*')
                .single();
            consumedItem = insertResult.data;
            itemError = insertResult.error;
        }

        if (itemError || !consumedItem) {
            console.error(`[${requestId}] Failed to save consumed item:`, itemError);
            return NextResponse.json(
                { error: 'Failed to save consumed item.', requestId },
                { status: 500, headers: rateLimitHeaders(rl) }
            );
        }

        const nutritionMutation = itemId
            ? supabase
                .from('consumed_item_nutrition')
                .update(nutrition)
                .eq('consumed_item_id', consumedItem.id)
                .select('*')
                .single()
            : supabase
                .from('consumed_item_nutrition')
                .insert({
                    consumed_item_id: consumedItem.id,
                    ...nutrition,
                })
                .select('*')
                .single();

        let { data: nutritionRow, error: nutritionError } = await nutritionMutation;

        if (itemId && nutritionError) {
            const upsertResult = await supabase
                .from('consumed_item_nutrition')
                .upsert({
                    consumed_item_id: consumedItem.id,
                    ...nutrition,
                }, { onConflict: 'consumed_item_id' })
                .select('*')
                .single();
            nutritionRow = upsertResult.data;
            nutritionError = upsertResult.error;
        }

        if (nutritionError) {
            console.error(`[${requestId}] Failed to insert consumed nutrition:`, nutritionError);
            if (!itemId) {
                await supabase.from('consumed_items').delete().eq('id', consumedItem.id);
            }
            return NextResponse.json(
                { error: 'Failed to save nutrition details.', requestId },
                { status: 500, headers: rateLimitHeaders(rl) }
            );
        }

        return NextResponse.json(
            { data: { item: consumedItem, nutrition: nutritionRow }, requestId },
            { headers: rateLimitHeaders(rl) }
        );
    } catch (error) {
        console.error(`[${requestId}] Consumed item save error:`, error);
        return NextResponse.json(
            { error: 'Failed to save consumed item', requestId },
            { status: 500, headers: rateLimitHeaders(rl) }
        );
    }
}
