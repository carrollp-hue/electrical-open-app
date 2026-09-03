import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type' };
const url = Deno.env.get('SUPABASE_URL')!;
const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const appUrl = 'https://electrical-open.pages.dev/';

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) throw new Error('Please sign in again.');
    const actorClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: userError } = await actorClient.auth.getUser();
    if (userError || !user) return Response.json({ error: 'Please sign in again.' }, { status: 401, headers: cors });
    const { data: role } = await service.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    if (!role) return Response.json({ error: 'Highest administrator access is required.' }, { status: 403, headers: cors });

    const { player_id, email, display_name } = await request.json();
    if (!player_id || !email || !display_name) return Response.json({ error: 'Player, email and display name are required.' }, { status: 400, headers: cors });
    const { data: player, error: playerError } = await service.from('players').select('id, profile_id, is_guest').eq('id', player_id).single();
    if (playerError || !player || player.is_guest || player.profile_id) return Response.json({ error: 'Choose an unlinked, non-guest player.' }, { status: 400, headers: cors });

    const { data: invited, error: inviteError } = await service.auth.admin.inviteUserByEmail(email, {
      data: { display_name },
      redirectTo: appUrl,
    });
    if (inviteError || !invited.user) return Response.json({ error: inviteError?.message || 'Could not create the invitation.' }, { status: 400, headers: cors });
    const userId = invited.user.id;
    const { error: profileError } = await service.from('profiles').upsert({ id: userId, display_name, password_change_required: true });
    if (profileError) throw profileError;
    const { error: linkError } = await service.from('players').update({ profile_id: userId }).eq('id', player_id).is('profile_id', null);
    if (linkError) throw linkError;
    return Response.json({ invited: true }, { headers: cors });
  } catch (error) {
    return Response.json({ error: error.message || 'Could not send invitation.' }, { status: 500, headers: cors });
  }
});
