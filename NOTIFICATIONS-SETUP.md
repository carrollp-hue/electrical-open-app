# Fixture notifications setup

This sends browser push notifications only for a new fixture, a date/time change, or published results.

1. In Supabase SQL Editor, run `supabase/upgrade-014-push-notifications.sql`.
2. Generate VAPID keys on your computer:
   ```powershell
   npx web-push generate-vapid-keys
   ```
3. Put the displayed public key in `supabase-config.js` as `pushVapidPublicKey`.
4. In Supabase Edge Functions, deploy `supabase/functions/fixture-notifications/index.ts`. Add these secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` (for example `mailto:your@email.com`).
5. In Supabase Dashboard → Database → Webhooks, create a webhook for the `fixtures` table on both `INSERT` and `UPDATE`. Point it to the `fixture-notifications` Edge Function and add an auth header with the service-role key.
6. Deploy the app. Each member signs in and chooses **Enable fixture notifications** from the profile menu.

On iPhone, the app needs to be added to the Home Screen before iOS can offer web-push notifications.

## Administrator action notifications

To notify membership and full administrators when a player asks for their club handicap to be removed:

1. Run `supabase/upgrade-046-admin-request-notifications.sql` in the Supabase SQL Editor.
2. Re-deploy the existing `fixture-notifications` Edge Function using the updated file in `supabase/functions/fixture-notifications/index.ts`.
3. In Supabase Dashboard -> Database -> Webhooks, create one additional webhook:
   - Table: `app_notifications`
   - Event: `INSERT`
   - URL: the existing `fixture-notifications` Edge Function URL
   - Header: the same service-role authorisation header used by the fixture webhook

When a request is submitted, only users with `membership_admin` or `admin` access can see the in-app update or receive its push notification. Each administrator must have enabled notifications on their own device.
