import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const url = Deno.env.get('SUPABASE_URL')!;
const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const prompt = `Read this blank golf scorecard. Return JSON only, matching this shape:
{
  "tee_options": ["Yellow"],
  "course_rating": 67.8,
  "slope_rating": 116,
  "par": 69,
  "holes": [{"hole_number":1,"par":4,"stroke_index":8}]
}
Use null where a value is absent or illegible. Include exactly the 18 holes only when they can be read. Do not guess.`;

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return Response.json({ error: 'Please sign in again.' }, { status: 401, headers: cors });
    const actor = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: userError } = await actor.auth.getUser();
    if (userError || !user) return Response.json({ error: 'Please sign in again.' }, { status: 401, headers: cors });
    const { data: roles } = await service.from('user_roles').select('role').eq('user_id', user.id);
    if (!roles?.some(item => ['admin', 'scorekeeper', 'handicap_committee'].includes(item.role))) {
      return Response.json({ error: 'Administrator access is required.' }, { status: 403, headers: cors });
    }

    const { image_data_url } = await request.json();
    if (typeof image_data_url !== 'string' || !image_data_url.startsWith('data:image/')) {
      return Response.json({ error: 'Choose a scorecard image first.' }, { status: 400, headers: cors });
    }
    if (image_data_url.length > 8_000_000) {
      return Response.json({ error: 'Please use a smaller photo (under about 6 MB).' }, { status: 400, headers: cors });
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) return Response.json({ error: 'The scorecard scanner has not been configured yet.' }, { status: 503, headers: cors });
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: Deno.env.get('OPENAI_VISION_MODEL') || 'gpt-4.1-mini',
        input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }, { type: 'input_image', image_url: image_data_url, detail: 'high' }] }],
        text: { format: { type: 'json_object' } },
      }),
    });
    if (!response.ok) throw new Error(`Scanner service returned ${response.status}.`);
    const result = await response.json();
    const extracted = JSON.parse(result.output_text || '{}');
    return Response.json({ extracted }, { headers: cors });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Could not scan the scorecard.' }, { status: 500, headers: cors });
  }
});
