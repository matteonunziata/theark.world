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

## Round 2 (2026-10-03)
- **Brand:** the ARK logo (lockup and circle mark) in `public/brand/`, app icon in `src/app/icon.png`.
- **"Members" is now "Memberships"**, with tabs for members and tiers & pricing. The members portal link moved there from the sidebar.
- **Dashboard "Get set up" replaced by "Your to-dos"**: the signed-in person's open tasks as a checklist, plus a quick-add. Members get their own "Settling in" checklist in the portal.
- **Tiers and discounts are tables** (`membership_tiers`, `discounts`), seeded with Founding ₡100,000/month (50 spots), Standard ₡130,000/month, Jungle Ventures 30% off for life, and the pause rules. Contacts reference a tier and an optional discount.
- **Add to calendar** on tickets, booking confirmations, and ticket emails (Google link and `/t/{token}/calendar.ics`).
- **Apple Wallet** passes at `/t/{token}/wallet.pkpass`; hidden until the Apple pass certificate env vars are set (needs an Apple Developer account).
- **Members portal v2:** cities (members pick where they are), experiences and expeditions alongside classes and events, a directory where members choose to appear and to be open to messages, suggested connections (same city, shared interests), a feed with replies, and private member-to-member messages with live updates. This widens the directory from names only to what each member chooses to share (bio, interests, city, Instagram); email and phone stay private. Staff cannot read members' messages.

## Round 3 (farm shop catalog, finance ledger, Arkadia, team)

- **Farm shop catalog comes from thearkfarm.shop (Shopify).** One product row per size/flavour so each has its own price and stock. "Sync from website" adds new products and refreshes price, availability and the website photo; name, category, uploaded photo, description and stock edited in ARK OS are kept. Imported products start with stock counting off so they don't raise alerts before anyone counts.
- **Finance is a ledger, not monthly totals.** Every income and expense is one entry with a business line, party, method, reference and an optional receipt/invoice/bill file (private `finance` bucket, admins only). Payables and receivables are simply unpaid entries. Colones and dollars are never added together; totals show per currency. `finance_months` now only holds cash in bank and monthly notes.
- **Business lines** are editable on the Finance overview: Memberships, Events & experiences, Farm shop, Arkadia, Food & beverage, Real estate, Other.
- **Arkadia (the school)** is visible to admins and anyone in a division marked `is_school`. Families get a private, unguessable link per student (no account) showing the profile and updates marked "Family can see"; staff notes and staff-only updates never leave the database function. A new link can be made at any time, which turns the old one off.
- **School photos** live in a public bucket under random file names with no listing, so the family page can show them without sign-in. Revisit if Arkadia wants photos behind a login.
- **Team emails were assumed to be firstname@theark.world** (Rocío → rocio@). Correct them in Settings → Team if different; sign-in links match on email.
- **Roles for the roster:** Marat and Matteo admin; Farm → Shop staff; Operations → Division lead; Arkadia → Facilitator (sees Arkadia through the school division); Marketing → Sales.
