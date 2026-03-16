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
    const { sessions, period = 'week', household_calorie_target = 2000, family_size = 1 } = await request.json();

    if (!sessions || sessions.length === 0) {
      return NextResponse.json(
        { error: 'No session data provided' },
        { status: 400 }
      );
    }

    // Optimize: Summarize session data to reduce token usage
    // Include ALL nutrition fields so AI can compute accurate macro/micro breakdowns
    const sessionSummary = sessions.map(s => ({
      date: s.session_date,
      store: s.store_name,
      spent: s.total_spent,
      calories: s.total_calories,
      items: s.total_items,
      categories: s.grocery_items?.reduce((acc, item) => {
        acc[item.category] = (acc[item.category] || 0) + 1;
        return acc;
      }, {}),
      all_items: s.grocery_items?.map(i => {
        const nut = Array.isArray(i.nutrition_data)
          ? (i.nutrition_data.length > 0 ? i.nutrition_data[0] : null)
          : (i.nutrition_data || null);
        return {
          name: i.name,
          quantity: i.quantity,
          unit: i.unit,
          price: i.price,
          category: i.category,
          has_nutrition: !!nut,
          nutrition: nut ? {
            calories: nut.calories,
            protein_g: nut.protein_g,
            carbs_g: nut.carbs_g,
            fat_g: nut.fat_g,
            fiber_g: nut.fiber_g,
            sugar_g: nut.sugar_g,
            sodium_mg: nut.sodium_mg,
            potassium_mg: nut.potassium_mg,
            calcium_mg: nut.calcium_mg,
            iron_mg: nut.iron_mg,
            vitamin_a_mcg: nut.vitamin_a_mcg,
            vitamin_c_mg: nut.vitamin_c_mg,
            vitamin_d_mcg: nut.vitamin_d_mcg,
            vitamin_b12_mcg: nut.vitamin_b12_mcg,
            vitamin_e_mg: nut.vitamin_e_mg,
            vitamin_k_mcg: nut.vitamin_k_mcg,
            zinc_mg: nut.zinc_mg,
            magnesium_mg: nut.magnesium_mg,
            folate_mcg: nut.folate_mcg,
            omega_3_mg: nut.omega_3_mg,
          } : null
        };
      })
    }));

    // Count items with and without nutrition data
    const allItems = sessionSummary.flatMap(s => s.all_items || []);
    const itemsWithNutrition = allItems.filter(i => i.has_nutrition);
    const itemsWithoutNutrition = allItems.filter(i => !i.has_nutrition);

    const prompt = `You are an advanced nutrition and grocery analytics AI. Analyze this grocery shopping data and provide comprehensive insights.

Household Context:
- Family Size: ${family_size} people
- Target Daily Calories (Entire Household): ${household_calorie_target} cal/day

Shopping Summary (${period}):
Total Sessions: ${sessions.length}
Total Spent: $${sessions.reduce((s, sess) => s + (sess.total_spent || 0), 0).toFixed(2)}
Total Calories: ${sessions.reduce((s, sess) => s + (sess.total_calories || 0), 0).toLocaleString()}
Total Items: ${sessions.reduce((s, sess) => s + (sess.total_items || 0), 0)}
Items WITH nutrition data: ${itemsWithNutrition.length}
Items WITHOUT nutrition data: ${itemsWithoutNutrition.length}

Sessions Detail (includes ALL items with their nutrition data where available):
${JSON.stringify(sessionSummary, null, 2)}

CRITICAL TASK — MACRO & MICRONUTRIENT ESTIMATION:
Some items have "has_nutrition": false (no stored nutrition data). You MUST use your knowledge of food nutrition to ESTIMATE their macro and micronutrient values based on the item name, quantity, and unit. This is essential for accurate macro breakdown and micronutrient coverage.

For the "macro_breakdown" and "micronutrient_coverage" fields below:
1. Sum up nutrition from items that HAVE data
2. ESTIMATE nutrition for items that DON'T have data (use your food science knowledge)
3. Return the COMBINED totals representing the ENTIRE shopping period
4. For micronutrient_coverage, calculate percentage of Daily Value (DV) based on AVERAGE DAILY intake:
   - Daily Values: protein=50g, carbs=300g, fat=65g, fiber=25g, sugar=50g (max), sodium=2300mg, potassium=4700mg, calcium=1000mg, iron=18mg, vitamin_a=900mcg, vitamin_c=90mg, vitamin_d=20mcg, vitamin_b12=2.4mcg, vitamin_e=15mg, vitamin_k=120mcg, zinc=11mg, magnesium=420mg, folate=400mcg, omega_3=1600mg
   - Divide total intake by number of days in the period to get daily average, then calculate % of DV
   - Multiply DV by family_size for household comparison

Provide a detailed JSON response with this exact structure:
{
    "ai_summary": {
        "title": "Monthly Nutrition Pulse",
        "overview": "Brief overview characterization of recent shopping.",
        "highlights": ["Great protein choices", "Veggies on point"],
        "concerns": ["Slight uptick in salt", "Low fiber"],
        "action_items": ["Swap white bread for whole wheat", "Add a leafy green"]
    },
    "macro_breakdown": {
        "daily_avg_protein_g": 65,
        "daily_avg_carbs_g": 250,
        "daily_avg_fat_g": 55,
        "daily_avg_fiber_g": 18,
        "daily_avg_sugar_g": 40,
        "daily_avg_salt_g": 4.5,
        "daily_avg_calories": 1800,
        "estimation_note": "12 of 30 items had stored data; 18 were AI-estimated"
    },
    "micronutrient_coverage": {
        "vitamin_c_mg": 78,
        "calcium_mg": 62,
        "iron_mg": 85,
        "potassium_mg": 45,
        "vitamin_a_mcg": 70,
        "vitamin_d_mcg": 30,
        "vitamin_b12_mcg": 90,
        "vitamin_e_mg": 40,
        "vitamin_k_mcg": 55,
        "zinc_mg": 72,
        "magnesium_mg": 58,
        "folate_mcg": 48,
        "omega_3_mg": 35,
        "fiber_g": 72
    },
    "items_nutrition_estimates": [
        {
            "name": "Item name (only for items WITHOUT stored nutrition)",
            "estimated_calories": 200,
            "estimated_protein_g": 15,
            "estimated_carbs_g": 10,
            "estimated_fat_g": 8,
            "estimated_fiber_g": 2,
            "estimated_sugar_g": 3,
            "confidence": "high"
        }
    ],
    "consumption_predictions": {
        "estimated_days_supply": 14,
        "next_shopping_predicted": "Nov 2nd",
        "estimated_weekly_spend": 120,
        "estimated_monthly_spend": 450,
        "items_likely_to_run_out_first": ["Milk", "Eggs", "Bananas"]
    },
    "nutrition_insights": {
        "nutrition_grade": "A",
        "nutrition_grade_explanation": "You hit almost all macronutrients perfectly with a strong bias towards whole foods.",
        "protein_adequacy": "sufficient",
        "sugar_alert": "within limits",
        "salt_assessment": "within limits"
    },
    "spending_analytics": {
        "cost_per_calorie": 0.02,
        "cost_per_person_per_day": 8.50,
        "most_expensive_category": "Protein",
        "potential_savings": "Switching from pre-cut to whole veggies could save ~$12/week"
    },
    "health_predictions": {
        "weight_impact": "Neutral/Maintenance",
        "energy_level_forecast": "Stable, high",
        "immune_support_score": 85,
        "gut_health_indicator": "Excellent"
    },
    "food_waste_risk": {
        "estimated_waste_percentage": 5,
        "high_waste_risk_items": ["Strawberries", "Spinach"],
        "tips_to_reduce_waste": ["Freeze spinach", "Store strawberries in glass containers"]
    },
    "red_flags": {
        "unhealthy_items": ["Highly processed chips (high sodium)", "Sugary cereal (low fiber, high sugar)"],
        "critical_warnings": ["Sodium intake is consistently 30% over the household maximum due to canned soups."]
    },
    "smart_recommendations": {
        "missing_nutrients": ["Fiber", "Omega-3"],
        "items_to_buy": ["Add Lentils for fiber and protein", "Buy chia seeds for Omega-3 and fiber"]
    }
}

NOTE on "micronutrient_coverage": Each value is a PERCENTAGE (0-100+) of the household daily value. For example, 78 means the household gets 78% of its daily vitamin C needs from this shopping period's groceries (averaged per day).

NOTE on "items_nutrition_estimates": Only include items that did NOT have stored nutrition data. The AI should estimate their nutrition based on typical nutritional values for those foods. Include a "confidence" field: "high", "medium", or "low".

IMPORTANT: Return ONLY valid JSON. No markdown, no explanations outside the JSON.`;

    const { data, provider } = await generateJSON(prompt);
    return NextResponse.json(
      { data, provider },
      { headers: rateLimitHeaders(rl) }
    );
  } catch (error) {
    console.error('AI analytics error:', error);

    const fallbackData = {
      ai_summary: {
        title: 'Fallback Summary',
        overview: 'AI analysis temporarily unavailable. Add a DeepSeek key as fallback.',
        highlights: [],
        concerns: [],
        action_items: []
      },
      consumption_predictions: null,
      nutrition_insights: null,
      spending_analytics: null,
      health_predictions: null,
      food_waste_risk: null,
      red_flags: null,
      smart_recommendations: null
    };

    return NextResponse.json(
      {
        data: fallbackData,
        provider: 'local',
        warning: error.message,
      },
      { status: 200, headers: rateLimitHeaders(rl) }
    );
  }
}
