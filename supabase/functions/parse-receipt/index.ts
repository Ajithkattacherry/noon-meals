// Supabase Edge Function: parse-receipt
// Deploy with: supabase functions deploy parse-receipt
// Set secret:  supabase secrets set GEMINI_API_KEY=your_key

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  fileBase64: string
  mimeType: string
  fileName?: string
  ingredients?: { id: string; name: string; unit: string; category?: string }[]
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY secret is not configured in Supabase.' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const body = (await req.json()) as RequestBody
    if (!body.fileBase64 || !body.mimeType) {
      return new Response(JSON.stringify({ error: 'fileBase64 and mimeType are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const ingredientList = (body.ingredients ?? [])
      .map((i) => `${i.name} (${i.unit}, ${i.category ?? 'grocery'})`)
      .join(', ')

    const prompt = `You are a receipt and bill parser for a Kerala school noon meal program.
The image/PDF may contain printed English, handwritten English, or handwritten Malayalam.
Known ingredients in the database: ${ingredientList || 'None provided'}.

Extract the bill details and return ONLY valid JSON matching this schema:
{
  "supplier": string | null,
  "billNumber": string | null,
  "billDate": "YYYY-MM-DD" | null,
  "totalAmount": number | null,
  "items": [
    {
      "rawName": string,
      "matchedIngredientName": string | null,
      "destination": "purchase" | "fixed_bill",
      "category": "vegetable" | "grocery" | "snacks" | "fixed",
      "quantity": number,
      "unit": "Kg" | "Gram" | "Liter" | "Millilitre" | "Each",
      "totalPrice": number
    }
  ]
}

Rules:
- Convert dates like 03-10-2026 or 03/10/26 to YYYY-MM-DD.
- For gas cylinders, transportation, loading, or lump-sum rice bills, set destination to "fixed_bill" and category to "fixed".
- For vegetables, groceries, provisions, milk, eggs, and snacks, set destination to "purchase".
- If an item matches one of the known ingredients, put its exact name in matchedIngredientName.
- If quantity is missing on a fixed bill or lump sum, use 1 and unit "Each".`

    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: body.mimeType,
                    data: body.fileBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
      },
    )

    if (!geminiResp.ok) {
      const errText = await geminiResp.text()
      return new Response(JSON.stringify({ error: `Gemini API error: ${errText}` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const geminiJson = await geminiResp.json()
    const rawText = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
    const parsed = JSON.parse(rawText)

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unexpected error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
