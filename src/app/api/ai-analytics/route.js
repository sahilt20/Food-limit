import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return NextResponse.json(
                { error: 'Gemini API key not configured' },
                { status: 500 }
            );
        }

        const { sessions, period = 'week' } = await request.json();

        if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
            return NextResponse.json({ error: 'No session data provided' }, { status: 400 });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const sessionData = sessions.map((s, i) =>
            `${i + 1}. "${s.session_name}" on ${s.session_date} at ${s.store_name || 'unknown store'} — ${s.total_items || 0} items, ${s.total_calories || 0} cal, $${(s.total_spent || 0).toFixed(2)}`
        ).join('\n');

        const prompt = `You are an advanced nutrition and grocery analytics AI. Analyze this grocery shopping data and provide comprehensive insights.

Shopping History:
${sessionData}

Analysis Period: ${period} (week/month/year)

Return ONLY a valid JSON object (no markdown, no code fences):
{
  "consumption_predictions": {
    "estimated_days_supply": 7,
    "items_likely_to_run_out_first": ["item1", "item2", "item3"],
    "next_shopping_predicted": "YYYY-MM-DD",
    "estimated_weekly_spend": 75.00,
    "estimated_monthly_spend": 300.00
  },
  "nutrition_insights": {
    "daily_calorie_average": 2100,
    "protein_adequacy": "sufficient/insufficient/excessive",
    "fiber_assessment": "good/needs improvement",
    "sugar_alert": "within limits/high/very high",
    "salt_assessment": "within limits/high/concerning",
    "vitamin_gaps": ["vitamin D", "calcium"],
    "nutrition_grade": "A/B/C/D/F",
    "nutrition_grade_explanation": "Brief explanation of the grade"
  },
  "spending_analytics": {
    "cost_per_calorie": 0.05,
    "most_expensive_category": "Protein",
    "best_value_items": ["item1", "item2"],
    "potential_savings": "$12-15/week by switching to store brands",
    "spending_trend": "increasing/stable/decreasing"
  },
  "ai_summary": {
    "title": "Your ${period}ly Nutrition Report",
    "overview": "2-3 sentence overview of shopping and nutrition habits",
    "highlights": ["positive highlight 1", "positive highlight 2"],
    "concerns": ["concern 1 if any", "concern 2 if any"],
    "action_items": [
      "Specific actionable recommendation 1",
      "Specific actionable recommendation 2",
      "Specific actionable recommendation 3"
    ]
  },
  "health_predictions": {
    "weight_impact": "maintenance/slight gain/slight loss based on calorie intake",
    "energy_level_forecast": "good/moderate/low based on macro balance",
    "immune_support_score": 72,
    "gut_health_indicator": "good/fair/needs attention"
  },
  "food_waste_risk": {
    "high_waste_risk_items": ["perishable item 1", "perishable item 2"],
    "tips_to_reduce_waste": ["tip 1", "tip 2"],
    "estimated_waste_percentage": 15
  }
}

Rules:
- Base ALL estimates on the actual shopping data provided
- Be specific with numbers and dates
- For consumption predictions, consider typical household consumption rates
- For nutrition insights, compare against recommended daily values
- Be honest about gaps or concerns, but keep tone constructive
- If data is limited, say so and provide estimates with caveats
- Make action items specific and achievable`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        let parsed;
        try {
            parsed = JSON.parse(responseText);
        } catch {
            const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) {
                parsed = JSON.parse(jsonMatch[1].trim());
            } else {
                const objMatch = responseText.match(/\{[\s\S]*\}/);
                if (objMatch) {
                    parsed = JSON.parse(objMatch[0]);
                } else {
                    throw new Error('Could not parse AI response');
                }
            }
        }

        return NextResponse.json({ success: true, data: parsed });
    } catch (error) {
        console.error('AI analytics error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to get analytics' },
            { status: 500 }
        );
    }
}
