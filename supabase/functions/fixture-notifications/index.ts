import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Fixture = { id: string; name: string; fixture_date: string; tee_time?: string | null; status?: string | null };
type AppNotification = { title: string; body: string; url?: string | null; audience?: 'all' | 'membership_admin' | 'profile'; recipient_profile_id?: string | null };
type Webhook = { type: 'INSERT' | 'UPDATE'; table?: string; record: Fixture | AppNotification; old_record?: Fixture };

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')!, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);

const when = (fixture: Fixture) => `${fixture.fixture_date}${fixture.tee_time ? ` at ${fixture.tee_time.slice(0, 5)}` : ''}`;

Deno.serve(async request => {
  const payload = await request.json() as Webhook;
  if (payload.table === 'app_notifications') {
    const notification = payload.record as AppNotification;
    if (payload.type !== 'INSERT' || !['membership_admin', 'profile'].includes(notification.audience || '')) {
      return Response.json({ sent: 0, reason: 'No targeted notification required' });
    }

    let recipientIds: string[] = [];
    if (notification.audience === 'membership_admin') {
      const { data: roles, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['membership_admin', 'admin']);
      if (roleError) return Response.json({ error: roleError.message }, { status: 500 });
      recipientIds = [...new Set((roles || []).map(role => role.user_id))];
    } else if (notification.recipient_profile_id) {
      recipientIds = [notification.recipient_profile_id];
    }
    if (!recipientIds.length) return Response.json({ sent: 0, reason: 'No eligible notification recipients' });

    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .in('profile_id', recipientIds);
    if (error) return Response.json({ error: error.message }, { status: 500 });

    const message = JSON.stringify({
      title: notification.title,
      body: notification.body,
      url: notification.url || '/#admin/members',
    });
    const deliveries = await Promise.allSettled((subscriptions || []).map(subscription => webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, message)));
    const expired = deliveries.flatMap((result, index) => result.status === 'rejected' && [404, 410].includes(result.reason?.statusCode) ? [subscriptions![index].endpoint] : []);
    if (expired.length) await supabase.from('push_subscriptions').delete().in('endpoint', expired);
    return Response.json({ sent: deliveries.length - expired.length });
  }

  const fixture = payload.record as Fixture, previous = payload.old_record;
  let title = '', body = '';
  if (payload.type === 'INSERT') {
    title = 'New Electrical Open fixture'; body = `${fixture.name} — ${when(fixture)}`;
  } else if (['published', 'completed'].includes(fixture.status || '') && !['published', 'completed'].includes(previous?.status || '')) {
    title = 'Results published'; body = `${fixture.name} results are now available.`;
  } else if (fixture.fixture_date !== previous?.fixture_date || fixture.tee_time !== previous?.tee_time) {
    title = 'Fixture time updated'; body = `${fixture.name} is now ${when(fixture)}.`;
  } else return Response.json({ sent: 0, reason: 'No notification-worthy change' });

  const { data: subscriptions, error } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth');
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const message = JSON.stringify({ title, body, url: `/#fixtures/${fixture.id}` });
  const deliveries = await Promise.allSettled((subscriptions || []).map(subscription => webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, message)));
  const expired = deliveries.flatMap((result, index) => result.status === 'rejected' && [404, 410].includes(result.reason?.statusCode) ? [subscriptions![index].endpoint] : []);
  if (expired.length) await supabase.from('push_subscriptions').delete().in('endpoint', expired);
  return Response.json({ sent: deliveries.length - expired.length });
});
