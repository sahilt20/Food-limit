import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabaseServer';
import { generateJSON } from '@/lib/aiProvider';
import { checkRateLimit, rateLimitHeaders } from '@/lib/rateLimit';
import {
    sanitizeString,
    validatePositiveInt,
    validatePositiveNumber,
    generateRequestId,
} from '@/lib/validation';

const VALID_SEX = new Set(['male', 'female', 'other']);
const VALID_ACTIVITY = new Set(['sedentary', 'light', 'moderate', 'active', 'very_active']);
const VALID_DIET_STYLES = new Set([
    'omnivore',
    'vegetarian',
    'vegan',
    'pescatarian',
    'halal',
    'high-protein',
    'low-carb',
]);

const ACTIVITY_MULTIPLIERS = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
};

const STORE_RANKING = [
    { store: 'Aldi', rank: 1, label: 'Best value' },
    { store: 'Lidl', rank: 2, label: 'Budget-friendly' },
    { store: 'Asda', rank: 3, label: 'Low-cost mainstream' },
    { store: 'Tesco', rank: 4, label: 'Mid-market' },
    { store: "Sainsbury's", rank: 5, label: 'Mid-premium' },
    { store: 'Morrisons', rank: 6, label: 'Traditional supermarket' },
    { store: 'Marks & Spencer', rank: 7, label: 'Premium' },
];

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function round(value, decimals = 0) {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}

function normalizeChoice(value, validSet, fallback) {
    if (typeof value !== 'string') return fallback;
    const normalized = value.trim().toLowerCase();
    return validSet.has(normalized) ? normalized : fallback;
}

function normalizeList(value, maxItems = 12) {
    const raw = Array.isArray(value)
        ? value
        : typeof value === 'string'
            ? value.split(/[,\n]/)
            : [];

    return raw
        .map((entry) => sanitizeString(String(entry), 60))
        .filter(Boolean)
        .slice(0, maxItems);
}

function calculateMacroTargets(calorieTarget, targetWeightKg) {
    let proteinG = clamp(Math.round(targetWeightKg * 1.8), 90, Math.round((calorieTarget * 0.4) / 4));
    let fatG = clamp(Math.round(targetWeightKg * 0.8), 45, Math.round((calorieTarget * 0.35) / 9));
    let carbsG = Math.round((calorieTarget - (proteinG * 4) - (fatG * 9)) / 4);

    if (carbsG < 60) {
        fatG = Math.max(45, fatG - Math.ceil(((60 - carbsG) * 4) / 9));
        carbsG = Math.round((calorieTarget - (proteinG * 4) - (fatG * 9)) / 4);
    }

    if (carbsG < 60) {
        proteinG = Math.max(Math.round(targetWeightKg * 1.4), proteinG - (60 - carbsG));
        carbsG = Math.round((calorieTarget - (proteinG * 4) - (fatG * 9)) / 4);
    }

    return {
        protein_g: proteinG,
        fat_g: fatG,
        carbs_g: Math.max(60, carbsG),
    };
}

function calculateTargets(input) {
    const { sex, age, heightCm, currentWeightKg, targetWeightKg, activityLevel, paceKgPerWeek } = input;
    const sexOffset = sex === 'male' ? 5 : sex === 'female' ? -161 : -78;
    const bmr = round((10 * currentWeightKg) + (6.25 * heightCm) - (5 * age) + sexOffset);
    const maintenanceCalories = round(bmr * (ACTIVITY_MULTIPLIERS[activityLevel] || ACTIVITY_MULTIPLIERS.sedentary));

    const calorieFloor = sex === 'male' ? 1500 : sex === 'female' ? 1200 : 1350;
    const maxSustainableDeficit = Math.max(250, maintenanceCalories - calorieFloor);
    const requestedDeficit = Math.round((paceKgPerWeek * 7700) / 7);
    const dailyDeficit = clamp(requestedDeficit, 250, Math.min(1000, maxSustainableDeficit));
    const calorieTarget = Math.max(calorieFloor, maintenanceCalories - dailyDeficit);
    const actualWeeklyLossKg = round((dailyDeficit * 7) / 7700, 2);
    const weightToLoseKg = round(currentWeightKg - targetWeightKg, 1);
    const projectedWeeksToGoal = Math.max(1, Math.ceil(weightToLoseKg / Math.max(actualWeeklyLossKg, 0.1)));
    const bmiCurrent = round(currentWeightKg / ((heightCm / 100) ** 2), 1);
    const bmiTarget = round(targetWeightKg / ((heightCm / 100) ** 2), 1);
    const macros = calculateMacroTargets(calorieTarget, targetWeightKg);

    return {
        bmr,
        maintenance_calories: maintenanceCalories,
        calorie_target: calorieTarget,
        daily_deficit: dailyDeficit,
        estimated_weekly_loss_kg: actualWeeklyLossKg,
        projected_weeks_to_goal: projectedWeeksToGoal,
        weight_to_lose_kg: weightToLoseKg,
        bmi_current: bmiCurrent,
        bmi_target: bmiTarget,
        calorie_floor: calorieFloor,
        hydration_liters: round(currentWeightKg * 0.033, 1),
        macro_targets: {
            ...macros,
            fiber_g: sex === 'male' ? 30 : 25,
        },
        compliance_checks: [
            `Calories capped safely above the ${calorieFloor} kcal floor.`,
            `Projected pace is ${actualWeeklyLossKg} kg/week based on a ${dailyDeficit} kcal daily deficit.`,
            'Macro targets are tuned to preserve muscle during fat loss.',
        ],
    };
}

function normalizeStoreOptions(rawOptions) {
    const options = Array.isArray(rawOptions) ? rawOptions : [];

    return options
        .map((option) => ({
            store: sanitizeString(option?.store || '', 40),
            note: sanitizeString(option?.note || '', 100),
            price_tier: STORE_RANKING.find((entry) => entry.store.toLowerCase() === String(option?.store || '').toLowerCase())?.rank || 99,
        }))
        .filter((option) => option.store)
        .sort((a, b) => a.price_tier - b.price_tier);
}

function normalizeDietPlanResponse(rawData, targets, profile) {
    const shoppingList = Array.isArray(rawData?.shopping_list)
        ? rawData.shopping_list.map((group) => ({
            category: sanitizeString(group?.category || 'Essentials', 50),
            items: Array.isArray(group?.items)
                ? group.items.map((item) => ({
                    item: sanitizeString(item?.item || '', 60),
                    total_amount: sanitizeString(item?.total_amount || '', 40),
                    used_in: Array.isArray(item?.used_in)
                        ? item.used_in.map((entry) => sanitizeString(entry, 60)).filter(Boolean).slice(0, 8)
                        : [],
                    store_options: normalizeStoreOptions(item?.store_options),
                })).filter((item) => item.item)
                : [],
        })).filter((group) => group.items.length > 0)
        : [];

    const dailyPlan = Array.isArray(rawData?.daily_plan)
        ? rawData.daily_plan.map((day, index) => ({
            day: validatePositiveInt(day?.day, 1, 30, index + 1),
            focus: sanitizeString(day?.focus || '', 120),
            meals: Array.isArray(day?.meals)
                ? day.meals.map((meal, mealIndex) => ({
                    meal_label: sanitizeString(meal?.meal_label || `Meal ${mealIndex + 1}`, 40),
                    name: sanitizeString(meal?.name || 'Planned meal', 100),
                    calories: validatePositiveInt(meal?.calories, 0, 4000, 0),
                    protein_g: round(validatePositiveNumber(meal?.protein_g, 0, 300, 0), 1),
                    carbs_g: round(validatePositiveNumber(meal?.carbs_g, 0, 400, 0), 1),
                    fat_g: round(validatePositiveNumber(meal?.fat_g, 0, 200, 0), 1),
                    prep_minutes: validatePositiveInt(meal?.prep_minutes, 0, 240, 0),
                    ingredients: Array.isArray(meal?.ingredients)
                        ? meal.ingredients.map((ingredient) => ({
                            item: sanitizeString(ingredient?.item || '', 60),
                            amount: sanitizeString(ingredient?.amount || '', 30),
                            notes: sanitizeString(ingredient?.notes || '', 80),
                        })).filter((ingredient) => ingredient.item && ingredient.amount)
                        : [],
                    steps: Array.isArray(meal?.steps)
                        ? meal.steps.map((step) => sanitizeString(step, 180)).filter(Boolean).slice(0, 6)
                        : [],
                }))
                : [],
            day_totals: {
                calories: validatePositiveInt(day?.day_totals?.calories, 0, 10000, targets.calorie_target),
                protein_g: round(validatePositiveNumber(day?.day_totals?.protein_g, 0, 500, targets.macro_targets.protein_g), 1),
                carbs_g: round(validatePositiveNumber(day?.day_totals?.carbs_g, 0, 600, targets.macro_targets.carbs_g), 1),
                fat_g: round(validatePositiveNumber(day?.day_totals?.fat_g, 0, 300, targets.macro_targets.fat_g), 1),
            },
        }))
        : [];

    return {
        profile: {
            ...profile,
        },
        summary: {
            headline: sanitizeString(rawData?.summary?.headline || 'Structured fat-loss meal plan', 160),
            ...targets,
            notes: Array.isArray(rawData?.summary?.notes)
                ? rawData.summary.notes.map((note) => sanitizeString(note, 160)).filter(Boolean).slice(0, 6)
                : [],
        },
        daily_plan: dailyPlan,
        shopping_list: shoppingList,
        execution_guide: Array.isArray(rawData?.execution_guide)
            ? rawData.execution_guide.map((step) => sanitizeString(step, 180)).filter(Boolean).slice(0, 8)
            : [],
        store_ranking: STORE_RANKING,
        store_ranking_note: 'Estimated UK supermarket value positioning, sorted from cheapest to most premium.',
        generated_at: new Date().toISOString(),
    };
}

function buildPlanContext(rawPlan) {
    return {
        summary_headline: sanitizeString(rawPlan?.summary?.headline || '', 140),
        summary_notes: Array.isArray(rawPlan?.summary?.notes)
            ? rawPlan.summary.notes.map((note) => sanitizeString(note, 140)).filter(Boolean).slice(0, 6)
            : [],
        daily_focuses: Array.isArray(rawPlan?.daily_plan)
            ? rawPlan.daily_plan
                .map((day) => sanitizeString(day?.focus || `Day ${day?.day || ''}`, 120))
                .filter(Boolean)
                .slice(0, 7)
            : [],
        shopping_categories: Array.isArray(rawPlan?.shopping_list)
            ? rawPlan.shopping_list
                .map((group) => sanitizeString(group?.category || '', 60))
                .filter(Boolean)
                .slice(0, 10)
            : [],
    };
}

export async function POST(request) {
    const requestId = generateRequestId();
    const rl = checkRateLimit(request, 'generate-diet-plan');

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

        const age = validatePositiveInt(body?.age, 18, 90, 30);
        const heightCm = validatePositiveNumber(body?.heightCm, 120, 230, 170);
        const currentWeightKg = validatePositiveNumber(body?.currentWeightKg, 35, 300, 80);
        const targetWeightKg = Number.parseFloat(body?.targetWeightKg);

        if (!Number.isFinite(targetWeightKg) || targetWeightKg < 30 || targetWeightKg >= currentWeightKg) {
            return NextResponse.json(
                { error: 'Target weight must be lower than current weight.', requestId },
                { status: 400, headers: rateLimitHeaders(rl) }
            );
        }

        const profile = {
            sex: normalizeChoice(body?.sex, VALID_SEX, 'male'),
            age,
            height_cm: heightCm,
            current_weight_kg: currentWeightKg,
            target_weight_kg: round(targetWeightKg, 1),
            activity_level: normalizeChoice(body?.activityLevel, VALID_ACTIVITY, 'moderate'),
            diet_style: normalizeChoice(body?.dietStyle, VALID_DIET_STYLES, 'omnivore'),
            preferred_proteins: normalizeList(body?.preferredProteins, 10),
            excluded_foods: normalizeList(body?.excludedFoods, 14),
            allergies: normalizeList(body?.allergies, 10),
            meals_per_day: validatePositiveInt(body?.mealsPerDay, 3, 6, 4),
            plan_days: validatePositiveInt(body?.planDays, 1, 7, 3),
            pace_kg_per_week: round(validatePositiveNumber(body?.paceKgPerWeek, 0.2, 1.25, 0.5), 2),
        };
        const userFeedback = sanitizeString(body?.userFeedback || '', 600);
        const currentPlanContext = buildPlanContext(body?.currentPlanContext);

        const targets = calculateTargets({
            sex: profile.sex,
            age: profile.age,
            heightCm: profile.height_cm,
            currentWeightKg: profile.current_weight_kg,
            targetWeightKg: profile.target_weight_kg,
            activityLevel: profile.activity_level,
            paceKgPerWeek: profile.pace_kg_per_week,
        });

        const prompt = `You are an elite clinical nutritionist and fat-loss meal planner.

Create a practical ${profile.plan_days}-day fat-loss plan for one adult.

Profile:
${JSON.stringify(profile)}

Calculated targets. Follow these closely:
${JSON.stringify(targets)}

Estimated UK store order:
${JSON.stringify(STORE_RANKING)}

Revision context:
${JSON.stringify({
    requested_changes: userFeedback || 'No explicit feedback provided. Create the strongest first-pass plan.',
    previous_plan_context: currentPlanContext,
})}

Rules:
- Respect diet style, exclusions, and allergies strictly.
- Use preferred proteins when possible.
- Use grams or ml only.
- Build ${profile.meals_per_day} meals/snacks per day.
- Keep each meal compact: max 6 ingredients and max 3 short steps.
- Keep summary notes to max 4 items.
- Keep execution_guide to max 5 items.
- Keep shopping_list concise and consolidated.
- Keep the full response compact and valid JSON only.

Return ONLY valid JSON in this shape:
{
  "summary": {
    "headline": "string",
    "notes": ["string"]
  },
  "daily_plan": [
    {
      "day": 1,
      "focus": "string",
      "meals": [
        {
          "meal_label": "Breakfast",
          "name": "string",
          "calories": 0,
          "protein_g": 0,
          "carbs_g": 0,
          "fat_g": 0,
          "prep_minutes": 0,
          "ingredients": [
            { "item": "string", "amount": "string", "notes": "string" }
          ],
          "steps": ["string"]
        }
      ],
      "day_totals": {
        "calories": 0,
        "protein_g": 0,
        "carbs_g": 0,
        "fat_g": 0
      }
    }
  ],
  "shopping_list": [
    {
      "category": "Protein",
      "items": [
        {
          "item": "string",
          "total_amount": "string",
          "used_in": ["Day 1 lunch"],
          "store_options": [
            { "store": "Aldi", "note": "Best value for basics" },
            { "store": "Sainsbury's", "note": "Wider selection" },
            { "store": "Marks & Spencer", "note": "Premium option" }
          ]
        }
      ]
    }
  ],
  "execution_guide": ["string"]
}`;

        const { data, provider } = await generateJSON(prompt);
        const normalizedData = normalizeDietPlanResponse(data, targets, profile);
        let historyId = null;

        try {
            const supabase = await createClient();
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                const { data: historyRow } = await supabase
                    .from('diet_plan_generations')
                    .insert({
                        user_id: user.id,
                        title: normalizedData.summary?.headline || 'Structured fat-loss meal plan',
                        content: normalizedData,
                        input_params: body,
                        provider: provider || 'unknown',
                        feedback: userFeedback || null,
                        generation_mode: currentPlanContext.summary_headline ? 'regenerate' : 'fresh',
                    })
                    .select('id')
                    .single();

                historyId = historyRow?.id || null;
            }
        } catch (persistError) {
            console.error(`[${requestId}] Failed to persist diet plan history:`, persistError);
        }

        return NextResponse.json(
            { data: normalizedData, provider, requestId, historyId },
            { headers: rateLimitHeaders(rl) }
        );
    } catch (error) {
        console.error(`[${requestId}] Diet plan generation error:`, error);
        return NextResponse.json(
            { error: error.message || 'Failed to generate diet plan', requestId },
            { status: 500, headers: rateLimitHeaders(rl) }
        );
    }
}
