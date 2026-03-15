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

    const prompt = `You are an advanced nutrition and grocery analytics AI. Analyze this grocery shopping data and provide comprehensive insights based on the household target.

Household Context:
- Family Size: ${family_size} people
- Target Daily Calories (Entire Household Combined): ${household_calorie_target} calories

Shopping Data (${period} period):
${JSON.stringify(sessions, null, 2)}

Provide a detailed JSON response with this exact structure:
{
    "ai_summary": {
        "title": "Monthly Nutrition Pulse",
        "overview": "Brief overview characterization of recent shopping.",
        "highlights": ["Great protein choices", "Veggies on point"],
        "concerns": ["Slight uptick in salt", "Low fiber"],
        "action_items": ["Swap white bread for whole wheat", "Add a leafy green"]
    },
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
