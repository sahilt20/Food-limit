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

        const formData = await request.formData();
        const file = formData.get('receipt');

        if (!file) {
            return NextResponse.json({ error: 'No image uploaded' }, { status: 400 });
        }

        // Convert file to base64
        const bytes = await file.arrayBuffer();
        const base64 = Buffer.from(bytes).toString('base64');
        const mimeType = file.type || 'image/jpeg';

        // Initialize Gemini
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const prompt = `Analyze this grocery receipt image. Extract all food/grocery items with their details.

Return ONLY a valid JSON object with this exact structure (no markdown, no code fences, no explanation):
{
  "store_name": "store name if visible, or empty string",
  "items": [
    {
      "name": "item name (clean, readable name)",
      "quantity": 1,
      "unit": "piece",
      "price": 0.00,
      "category": "one of: Fruits, Vegetables, Protein, Dairy, Grains, Legumes, Oils, Snacks, Beverages, Spices, Other"
    }
  ],
  "total": 0.00
}

Rules:
- Extract every food/grocery item line you can see
- For quantity, use the number shown or default to 1
- For unit, use: piece, kg, g, lb, oz, L, ml, cup — default to "piece"
- For price, extract the price shown for that item, or 0 if not visible
- For category, classify each item into the most appropriate category
- Clean up item names — capitalize properly, remove item codes/SKUs
- Skip non-food items like bags, receipts metadata, tax lines, totals
- If the image is not a receipt, return {"error": "This doesn't appear to be a grocery receipt", "items": []}`;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64,
                    mimeType,
                },
            },
        ]);

        const responseText = result.response.text();

        // Parse JSON from response (handle potential markdown code fences)
        let parsed;
        try {
            // Try direct parse first
            parsed = JSON.parse(responseText);
        } catch {
            // Try extracting from code fences
            const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) {
                parsed = JSON.parse(jsonMatch[1].trim());
            } else {
                // Try finding JSON object in the text
                const objMatch = responseText.match(/\{[\s\S]*\}/);
                if (objMatch) {
                    parsed = JSON.parse(objMatch[0]);
                } else {
                    throw new Error('Could not parse AI response');
                }
            }
        }

        return NextResponse.json({
            success: true,
            data: parsed,
            raw_text: responseText,
        });
    } catch (error) {
        console.error('Gemini API error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to analyze receipt' },
            { status: 500 }
        );
    }
}
