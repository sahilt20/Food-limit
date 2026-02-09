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

        const { items } = await request.json();

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: 'No items provided' }, { status: 400 });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const itemList = items.map((item, i) =>
            `${i + 1}. ${item.name} (${item.quantity} ${item.unit}, $${item.price || 0})`
        ).join('\n');

        const prompt = `You are a nutrition and health expert. For each grocery item below, suggest a HEALTHIER alternative that is:
- Similar in taste/use but better nutritionally
- Lower in sugar, salt, or unhealthy fats where applicable
- Higher in fiber, protein, or micronutrients where possible
- Realistically available at grocery stores
- Roughly similar in price

Items:
${itemList}

Return ONLY a valid JSON object (no markdown, no code fences):
{
  "recommendations": [
    {
      "original": "original item name",
      "alternative": "healthier alternative name",
      "reason": "Short explanation of why this is healthier (1-2 sentences)",
      "nutrition_improvement": "e.g., '-40% sugar, +50% fiber'",
      "price_comparison": "similar/cheaper/slightly more",
      "swap_difficulty": "easy/moderate/hard"
    }
  ],
  "overall_tips": [
    "General tip about improving this grocery list's nutrition",
    "Another tip"
  ]
}

Rules:
- Provide a recommendation for EVERY item
- If an item is already very healthy (e.g., fresh vegetables), say so and suggest a complementary item instead
- Be specific with alternative names (not generic)
- Keep reasons concise but informative`;

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
        console.error('Recommendation error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to get recommendations' },
            { status: 500 }
        );
    }
}
