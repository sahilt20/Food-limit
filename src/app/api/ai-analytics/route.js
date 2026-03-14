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
    const { sessions, period = 'week' } = await request.json();

    if (!sessions || sessions.length === 0) {
      return NextResponse.json(
        { error: 'No session data provided' },
        { status: 400 }
      );
    }

    const prompt = `You are an advanced nutrition and grocery analytics AI. Analyze this grocery shopping data and provide comprehensive insights.

Shopping Data (${period} period):
${JSON.stringify(sessions, null, 2)}

Provide a detailed JSON response with this exact structure:
{
    "consumption_patterns": {
        "summary": "Brief overview of eating patterns",
        "top_categories": ["category1", "category2"],
        "frequency_insights": "How often they shop and what they buy most",
        "variety_score": 75
    },
    "nutrition_analysis": {
        "overall_score": 78,
        "strengths": ["Good protein intake", "Variety of fruits"],
        "weaknesses": ["Low fiber", "High sodium"],
        "macro_balance": "Description of macro nutrient balance",
        "micro_highlights": "Notable vitamin/mineral patterns"
    },
    "spending_insights": {
        "total_period": 245.50,
        "average_per_trip": 61.38,
        "most_expensive_category": "Protein",
        "budget_tips": ["Buy seasonal produce", "Consider bulk grains"],
        "cost_per_calorie": 0.02
    },
    "health_predictions": {
        "positive_trends": ["Increasing vegetable intake"],
        "concerns": ["Processed food frequency rising"],
        "recommendations": ["Add more leafy greens", "Reduce sugar intake"],
        "projected_health_score": 82
    },
    "food_waste_risk": {
        "risk_level": "medium",
        "high_risk_items": ["Leafy greens", "Berries"],
        "prevention_tips": ["Freeze berries within 3 days", "Plan meals around perishables"],
        "estimated_waste_percent": 15
    },
    "meal_suggestions": {
        "based_on_purchases": ["Chicken stir-fry with broccoli", "Oatmeal with berries"],
        "missing_ingredients": ["olive oil", "garlic"],
        "weekly_meal_plan_tip": "A brief tip for meal planning"
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

    // Return helpful template data as local fallback
    const fallbackData = {
      consumption_patterns: {
        summary: 'AI analysis temporarily unavailable. Add an OpenAI key as fallback.',
        top_categories: ['General'],
        frequency_insights: 'Unable to analyze — try again shortly.',
        variety_score: 0,
      },
      nutrition_analysis: {
        overall_score: 0,
        strengths: [],
        weaknesses: [],
        macro_balance: 'Analysis unavailable',
        micro_highlights: 'Analysis unavailable',
      },
      spending_insights: {
        total_period: 0,
        average_per_trip: 0,
        most_expensive_category: 'N/A',
        budget_tips: [],
        cost_per_calorie: 0,
      },
      health_predictions: {
        positive_trends: [],
        concerns: [],
        recommendations: ['Configure an AI API key for personalized insights'],
        projected_health_score: 0,
      },
      food_waste_risk: {
        risk_level: 'unknown',
        high_risk_items: [],
        prevention_tips: [],
        estimated_waste_percent: 0,
      },
      meal_suggestions: {
        based_on_purchases: [],
        missing_ingredients: [],
        weekly_meal_plan_tip: 'Configure an AI API key for meal suggestions',
      },
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
