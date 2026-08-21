import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = (request: Request) => ({
  'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
  'Access-Control-Allow-Headers': request.headers.get('access-control-request-headers') || 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin, Access-Control-Request-Headers',
});
const url = Deno.env.get('SUPABASE_URL')!;
const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const prompt = `Read this blank golf scorecard. It may show more than one tee. Return JSON only, matching this shape:
{
  "tees": [{
    "name": "Yellow",
    "course_rating": 67.8,
    "slope_rating": 116,
    "par": 69,
    "holes": [{"hole_number":1,"par":4,"stroke_index":8}]
  }]
}
Create a separate tee item for every tee with information on the card. Keep each tee's rating, slope, par and hole data together; never combine values from different tees. Use null where a value is absent or illegible. Include exactly the 18 holes only when they can be read. Do not guess.`;

Deno.serve(async request => {
  const headers = cors(request);
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return Response.json({ error: 'Please sign in again.' }, { status: 401, headers });
    const actor = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: userError } = await actor.auth.getUser();
    if (userError || !user) return Response.json({ error: 'Please sign in again.' }, { status: 401, headers });
    const { data: roles } = await service.from('user_roles').select('role').eq('user_id', user.id);
    if (!roles?.some(item => ['admin', 'scorekeeper', 'handicap_committee'].includes(item.role))) {
      return Response.json({ error: 'Administrator access is required.' }, { status: 403, headers });
    }

    const { image_data_url } = await request.json();
    if (typeof image_data_url !== 'string' || !image_data_url.startsWith('data:image/')) {
      return Response.json({ error: 'Choose a scorecard image first.' }, { status: 400, headers });
    }
    if (image_data_url.length > 8_000_000) {
      return Response.json({ error: 'Please use a smaller photo (under about 6 MB).' }, { status: 400, headers });
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return Response.json({ error: 'The Gemini scorecard scanner has not been configured yet.' }, { status: 503, headers });
    const image = image_data_url.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!image) return Response.json({ error: 'Please choose a standard image file.' }, { status: 400, headers });
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${Deno.env.get('GEMINI_VISION_MODEL') || 'gemini-3.6-flash'}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: image[1] || 'image/jpeg', data: image[2] || '' } }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0 },
      }),
    });
    if (!response.ok) throw new Error(`Gemini scanner returned ${response.status}: ${await response.text()}`);
    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.find((part: { text?: string }) => part.text)?.text;
    if (!text) throw new Error('Gemini did not return readable scorecard data.');
    const extracted = JSON.parse(text);
    return Response.json({ extracted }, { headers });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error instanceof Error ? error.message : 'Could not scan the scorecard.' }, { status: 500, headers });
  }
});
