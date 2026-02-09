import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return NextResponse.json(
                { error: 'Gemini API key not configured. Add GEMINI_API_KEY to your .env.local file.' },
                { status: 500 }
            );
        }

        const { items } = await request.json();

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: 'No items provided' }, { status: 400 });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const itemList = items.map((item, i) =>
            `${i + 1}. ${item.name} — ${item.quantity} ${item.unit}`
        ).join('\n');

        const prompt = `You are a nutrition expert. Analyze these grocery items and provide detailed nutrition data.

Items:
${itemList}

Return ONLY a valid JSON object (no markdown, no code fences):
{
  "items": [
    {
      "name": "item name",
      "calories": 150,
      "protein_g": 10.5,
      "carbs_g": 20.0,
      "fat_g": 5.2,
      "fiber_g": 3.1,
      "sugar_g": 8.0,
      "salt_g": 0.5,
      "vitamin_c_mg": 12.0,
      "vitamin_a_mcg": 100,
      "iron_mg": 2.1,
      "calcium_mg": 50,
      "potassium_mg": 300,
      "vitamin_d_mcg": 0,
      "category": "Fruits/Vegetables/Protein/Dairy/Grains/Legumes/Oils/Snacks/Beverages/Spices/Other",
      "health_score": 85,
      "health_notes": "Brief note about this food's nutritional value"
    }
  ],
  "summary": {
    "total_calories": 0,
    "total_protein_g": 0,
    "total_carbs_g": 0,
    "total_fat_g": 0,
    "total_sugar_g": 0,
    "total_salt_g": 0,
    "total_fiber_g": 0,
    "overall_health_score": 75,
    "diet_assessment": "Brief overall assessment of this grocery haul's nutritional quality"
  }
}

Rules:
- Calculate nutrition per the QUANTITY and UNIT specified (e.g., 2 kg of chicken → nutrition for 2kg)
- health_score is 0-100, where 100 = extremely healthy
- Be accurate with real-world nutritional data
- Include ALL items from the list`;

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
        console.error('Nutrition analysis error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to analyze nutrition' },
            { status: 500 }
        );
    }
}
