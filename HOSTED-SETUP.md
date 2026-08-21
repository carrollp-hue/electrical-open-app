# Hosted setup — Electrical Open Golf Society

## 1. Set up Supabase

1. Open the project `xwzrtbjlztdtxvwckqrl` in Supabase.
2. Open **SQL Editor**, create a new query, and run `supabase/schema.sql` in full.
3. In **Authentication > Users**, add your own administrator user. Copy that user's UUID.
4. Replace `OWNER-USER-UUID` in the final two commented lines of `schema.sql` with that UUID and run those two lines. This makes you the first app administrator.
5. In **Project Settings > API**, copy the **publishable/anon key** into `supabase-config.js`. This key is safe for browser code. Never use the `service_role` key in the app or share it.

## 2. Publish to Cloudflare Pages

1. Open the Cloudflare Pages project at `electrical-open.pages.dev`.
2. Choose **Deployments > Create deployment > Direct Upload**.
3. Upload the contents of this `electrical-open-app` folder, including the `supabase-config.js` file containing the publishable key.
4. Visit `https://electrical-open.pages.dev` and use the browser's **Add to Home Screen** option on a phone.

## 3. Administration model

- Use the app's future Admin area for members, fixtures, score entry, results, and committee decisions.
- Use Supabase only for owner-level tasks: invitations, emergency data recovery, role assignment, and exports.
- Keep at least two society-owned Supabase and Cloudflare owners. Export data monthly and after each fixture.

## Before member launch

- Run `supabase/upgrade-001.sql`, then run `supabase/import-workbook.sql` to import and reconcile historic workbook data.
- Run `supabase/upgrade-002-handicap-engine.sql`, then rerun `supabase/import-workbook.sql` once to load club-handicap and active committee settings.
- Run `supabase/upgrade-003-scorecards.sql` before using course-based fixtures or the 18-hole scorecard. It is safe to rerun if needed.
- Run `supabase/upgrade-004-fixture-start-sheets.sql` to show all current members' handicap and calculated playing handicap on future fixture pages.
- Run `supabase/upgrade-005-fixture-flow.sql` to add tee times and the score-finalization step for Playing Conditions Calculation.
- Run `supabase/upgrade-006-season-members-guests.sql` to manage annual fixture rosters and one-off guests.
- Run `supabase/upgrade-007-fixture-details.sql` to add competition names and enforce guest-name formatting.
- Run `supabase/upgrade-008-lock-historical-course-setups.sql` to prevent course and scorecard edits from altering a setup used by scored fixtures.
- Run `supabase/upgrade-009-non-return.sql` to record incomplete rounds as Non Return (NR).
- Run `supabase/upgrade-010-competitions-and-order-of-merit.sql` to add competition names and calculate final tie-break positions and Order of Merit points.
- Run `supabase/upgrade-011-validation-and-controls.sql` to enforce NR, publishing, PCC and member-only rules.
- Run `supabase/upgrade-012-club-handicap-date.sql` to record when each club handicap was last submitted.
- When entering a new result, enter the verified score differential plus any ESR adjustment or winner cut. Saving the score automatically creates an auditable, recalculated society-index snapshot.
- Build and test the handicap calculation function against the existing Excel workbook.
- Add the real login and admin screens.
- Test with the committee before inviting all members.
