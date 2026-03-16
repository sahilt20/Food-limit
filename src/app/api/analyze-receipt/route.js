import { NextResponse } from 'next/server';
import { generateVisionJSON } from '@/lib/aiProvider';
import { checkRateLimit, rateLimitHeaders } from '@/lib/rateLimit';

export async function POST(request) {
    const rl = checkRateLimit(request);
    if (!rl.allowed) {
        return NextResponse.json(
            { error: 'Too many requests. Please try again later.' },
            { status: 429, headers: rateLimitHeaders(rl) }
        );
    }

    try {
        const formData = await request.formData();
        const receipt = formData.get('receipt');

        if (!receipt) {
            return NextResponse.json(
                { error: 'No receipt image provided' },
                { status: 400 }
            );
        }

        // Convert file to buffer, then base64
        const bytes = await receipt.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const base64 = buffer.toString('base64');
        const mimeType = receipt.type || 'image/jpeg';

        const prompt = `You are an expert grocery receipt OCR parser. Carefully examine this receipt image and extract ALL purchased items, separating food from non-food.

CRITICAL INSTRUCTIONS:
1. **Decode abbreviated names** — supermarket receipts use short codes. Expand them to full readable names:
   - "JS BRTWATER 2L" → "Britvic Water 2L"
   - "JS CC CHESTNUT MUSHR" → "Chestnut Mushrooms"
   - "JS S/SKIM MLK 1.136L" → "Semi-Skimmed Milk 1.136L"
   - "ACTIVIA F/BERIS&CEX4" → "Activia Fruit Berries & Cereal x4"
   - "ST EWE FREE EGGS X6" → "Free Range Eggs x6"
   - "JS CHKN LIVER PATE" → "Chicken Liver Pate"
   - "ACTIMEL MULTIFRT X8" → "Actimel Multifruit x8"
   - "JS EXTRA LEAN PRK MI" → "Extra Lean Pork Mince"
   - "JS CNFRENCE PEARS X4" → "Conference Pears x4"
   Always decode to the FULL human-readable food name.

2. **Extract quantity from the item name** if it contains multipliers like "X4", "X6", "X8", "2L" etc.

3. **Classify each item as food or non-food**:
   - FOOD: anything edible — groceries, drinks, snacks, ingredients, condiments, etc.
   - NON-FOOD: household products, cleaning supplies, toiletries, paper goods, plastic bags, pet supplies, batteries, magazines, kitchenware, etc.
     Examples: dish soap, laundry detergent, trash bags, toilet paper, shampoo, toothpaste, sponges, foil, cling film, carrier bags, pet food

4. **Skip receipt metadata lines**: "Nectar Price Saving", "PRICE REDUCTION", "BALANCE DUE", "GIFT CARD", "CHANGE", "SAVINGS", "PROMOTIONS", payment details, loyalty points, etc.

5. **Handle currency**: Prices may be in £ (GBP), $ (USD), or € (EUR). Convert to numeric values (e.g., £2.55 → 2.55).

6. **Detect the store name** from the receipt header (e.g., "Sainsbury's", "Tesco", "Whole Foods").

7. **Assign accurate categories** to each item.

Return a JSON object:
{
    "store_name": "Store Name",
    "items": [
        {
            "name": "Full Human-Readable Item Name",
            "quantity": 1,
            "unit": "piece",
            "price": 2.55,
            "category": "Protein",
            "is_food": true
        }
    ],
    "non_food_items": [
        {
            "name": "Kitchen Roll 2-Pack",
            "quantity": 1,
            "unit": "piece",
            "price": 1.80,
            "category": "Household"
        }
    ],
    "total": 20.41
}

Food categories: Fruits, Vegetables, Protein, Dairy, Grains, Legumes, Oils, Snacks, Beverages, Spices, Other
Non-food categories: Household, Cleaning, Toiletries, Pet, Other

If the image is NOT a receipt, return: { "error": "This does not appear to be a grocery receipt" }

IMPORTANT: Return ONLY valid JSON. No markdown, no code fences, no explanations.`;

        try {
            const { data, provider } = await generateVisionJSON(prompt, base64, mimeType);
            return NextResponse.json(
                { data, provider },
                { headers: rateLimitHeaders(rl) }
            );
        } catch (aiError) {
            // All AI providers failed — tell client to use Tesseract.js
            return NextResponse.json(
                {
                    error: 'AI receipt analysis unavailable. The app will fall back to browser-based OCR.',
                    fallback: 'tesseract',
                    details: aiError.message,
                },
                { status: 503, headers: rateLimitHeaders(rl) }
            );
        }
    } catch (error) {
        console.error('Receipt analysis error:', error);
        return NextResponse.json(
            { error: error.message || 'Receipt analysis failed' },
            { status: 500 }
        );
    }
}
