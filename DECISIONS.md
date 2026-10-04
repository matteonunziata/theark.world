# Decisions

Running log of choices made while rebuilding ARK OS from `reference/prototype.html`.
Newest at the bottom of each section.

## Scope and cost
- **No paid services while it's a prototype.** Free tiers only: Vercel Hobby, Resend free, Stripe test mode, Cloudflare Turnstile. One Supabase project (`theark`) for everything, no separate staging database.
- **AI features (Ask AI, sequence drafting) come last** because the Claude API costs money. Wired so they can be switched on with an API key.

## Auth and access
- **Staff sign in with Google only, and only if they were added in Settings > Team** (user decision, 2026-10-03). Enforced by the Supabase "before user created" hook `public.hook_before_user_created`: Google accounts must be `@theark.world` (and Workspace `hd` must match when present) and must match an active `team_members` row. Google's `hd` param in the UI only filters the account picker.
- **Members sign in by email magic link**, allowed by the same hook only for contacts with an active membership. `@theark.world` addresses can't use magic links.
- Removing or deactivating a team member removes access at once: every policy checks `team_members.status = 'active'` through `public.staff_role()`.
- **Team emails can be any domain** (facilitators and contractors may not have `@theark.world`), but only `@theark.world` ones can sign in.
- **All active staff can read the team list and divisions** (names are needed for assignees, facilitators, leads). Only admins edit them.
- At least one active admin must always exist (checked in the server action).

## Data model
- Prototype arrays became tables: contact notes, pipeline stages, enrollments and sends, sequence steps, ticket types, session cancellations (was `skipDates`), stock movements (was `ledger`).
- Money is `numeric(14,2)` with a currency on each amount. CRC primary, USD alongside.
- `products.stock` is kept in step with `stock_movements` by a trigger.
- Finance is one row per month (`finance_months`), admin-only by RLS. Ticket revenue is an admin-only function.

## Events and tickets
- **Classes are members-only; events can be public** (user decision). Enforced by a check constraint and by `book_session`.
- Members and the public book only through `public.book_session`, which locks the offering row so two people can't take the last spot, and checks capacity, ticket quantity and double bookings.
- Each booking gets a random `qr_token` (two UUIDs, no dashes). The QR code links to `/t/{token}`. `ticket_by_token` returns the ticket's state (valid / used / expired / upcoming / cancelled). `check_in` is allowed for admin, lead, security, and the session's facilitator, and only on the session date.
- Payments: prototype-style payment links for now; Stripe (test mode) planned.

## Members directory
- Members see each other's **names only** (user decision), via `public.member_directory()`.

## Front end
- The prototype's CSS is ported verbatim into `src/app/ark.css` so the app looks the same; additions live in `src/app/ark-app.css`. Tailwind is available for new utilities.
- Forms open in the prototype's right-hand drawer (a native `<dialog>`) and post to server actions; the database does the real permission checks.
- No Cache Components: pages that read the session render per request.

## Testing
- RLS and sign-in hook tests live in `supabase/tests/rls.sql`. They run in one transaction against the live project and roll back. Run them with the Supabase MCP `execute_sql`, or `psql "$SUPABASE_DB_URL" -f supabase/tests/rls.sql`.
