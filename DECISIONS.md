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

## Round 4 (2026-10-04)

- **Member sign-in links work on any device.** The links were PKCE, which ties a link to the browser that asked for it; opening the email on a phone, or in the mail app's own browser, failed with "expired or opened in a different browser". Sign-in emails now use the implicit flow (`src/lib/supabase/link-client.ts`): `/auth/callback` passes the session fragment on to `/auth/confirm`, which stores it in cookies. Google sign-in still uses PKCE. The event page's sign-in link now returns you to the event.
- **One email look.** Every email goes through `arkEmail()` in `src/lib/email-template.ts` (canopy header with the ARK lockup, white card, mark in the footer). Tickets use it; workflow emails can now be sent from the send queue in it ("Send in ARK template"), via Resend. Supabase's own sign-in emails can't be sent from here: matching templates are generated into `supabase/templates/` (`bun scripts/auth-email-templates.ts`) to paste into Supabase → Authentication → Emails.
- **Real estate.** `lots` (status available / reserved / sold / not for sale, size, price, owner from the CRM, lot photo and aerial view, the home), `lot_household` (who lives there), `lot_maintenance` (work log with cost). Each lot has its own page. Price only shows while the lot isn't sold. Admin, lead and sales only (`is_estate_staff()`), photos in a public `estate` bucket with random names.
- **Hospitality = active stewardship.** A lot is "in hospitality" when its owner lists the home; it gets a nightly rate, sleeps, minimum nights and private notes. Stays (`stays`) are guest stays, owner use, or blocked dates; inquiries can overlap, but two confirmed stays in one home can't (exclusion constraint; check-out day is free for the next check-in). The Hospitality page has an availability search, a 4-week calendar, and arrivals/departures.
- **Sequences are now Workflows.** Same tables (`sequences`, `sequence_steps`), new name in the UI and at `/crm/workflows` (`/crm/sequences` redirects). Each workflow has its own page drawn as a flowchart (start → wait → step → … → complete); click any stage to edit it, "+" inserts a step. Workflows are still linear; branching would need a new data model. Progress is kept by step number, so inserting steps affects people already enrolled (the editor says so).
- **Members portal schedule** at `/portal/schedule`, with Day, Week and Month views and spots left; every session links to its booking page. On phones the tab bar shows Schedule instead of Explore (Explore is still on Home and in the desktop nav).
- **Gate rules.** A ticket only goes green on the session day, from one hour before the start time (`ticket_by_token` state `early` until then; `check_in` refuses too). Member passes (`contacts.pass_token`, page `/p/{token}`) are valid at any hour while the membership covers today: day passes on their day (`member_since`, or `renews_on` as the end date), week passes for seven days, other tiers until `renews_on`, or while active when no end date is set. Paused or inactive memberships are red. Staff who can work the gate see a full-screen green or red result when they open a scanned code, with Check in / Log entry right there. Entries are logged in `gate_entries`.
- **Passes save to Photos.** `/p/{token}/image.png` and `/t/{token}/image.png` render a phone-sized PNG. "Save to Photos" opens the phone's share sheet (Save Image); on desktop it downloads. Members open their pass from "My pass" in the portal header.
- **Arkadia timetable.** `school_schedule` holds a weekly rhythm per group (or the whole school) plus one-off dated entries. Staff edit it at `/arkadia/schedule`; families see their child's day and week on the family page (only entries for the child's group or the whole school).
- **Sample data** now includes five lots, a household, a maintenance log and stays. They were also added to the live sample set, so "Remove sample data" clears them.

## Round 5 (2026-10-04)

- **"Gate" is now "Security"** (nav, `/security`, copy). `/gate` redirects.
- **Scanning admits.** When someone who can work security opens a scanned code, the whole screen shows only what the guard needs: green with a check and "Access approved", or red with "Already used", "Too early", "Not today", "Expired", "Cancelled". A valid ticket is checked in on the scan itself, so a second scan reads "Already used". Member passes log an entry (they work every day). Guest passes are used up. Links inside the app add `?look=1` to open a code without admitting anyone; the code-lookup box on the Security page acts like a scan.
- **Membership pricing by term, with two rates.** Each tier has a rack rate and a friends & family rate; members are on one or the other (`contacts.rate`). Terms: day, week, month, 3 months, 6 months, year. Prices from the rate card: Monthly ₡130,000 / ₡100,000, 3 months ₡340,000 / ₡270,000, 6 months ₡630,000 / ₡500,000, Annual ₡1,100,000 / ₡900,000, Day ₡20,000 / ₡15,000, Week ₡50,000 / ₡40,000. "Standard" became "Monthly". Admins edit and add tiers in Memberships → Tiers & pricing.
- **Guest passes.** Each tier sets guest passes per calendar month: 4 for monthly, 3-month and 6-month (and Founding, Ambassador), 8 for annual, none for day and week passes. Members invite a guest by name, phone and/or email for a day in the next two months (portal → Guests); the guest gets a pass link (`/g/{token}`), by email when Resend is set up and by WhatsApp from the member's phone. A pass works once, on that day. Cancelling an unused invite gives the pass back. Security sees today's guests.
- **Sign-in emails in the ARK look.** With `RESEND_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` set, the app makes the sign-in link itself (`auth.admin.generateLink`) and sends it in the ARK template with a 6-digit code; the sign-in page then asks for the code, which works on any device. The same eligibility rules as the sign-in hook are checked first. Without those keys, Supabase's own email is used as before.
- **Workflow messages can be formatted.** `## heading`, `**bold**`, `- lists`, `![image](url)` and `[[Button|https://…]]`; plain text still works. Images upload to a public `email` bucket. WhatsApp and the text part of emails get a plain version.
- **AI in workflows** (Claude Opus 5.5, structured output, server-side refusal fallback). "Draft the whole workflow" and "Write this step" both put a draft in the editor; nothing is saved or sent until a person saves. Off until `ANTHROPIC_API_KEY` is set.
- **Hospitality listings.** Each home has a listing page (`/hospitality/{id}`): photo gallery with cover and captions, title, description, sleeps/bedrooms/beds/baths, rate, cleaning fee, minimum nights, check-in and check-out times, amenities, house rules, private team notes, and an availability calendar where the team blocks nights or books stays. Publish puts it on the public site.
- **Public booking site** at `/stay` (search by dates and guests) and `/stay/{id}` (gallery, details, calendar of free nights, request form). Requests land as inquiries; nothing is held or charged until the team confirms. The public functions return only listing details and taken dates, never owners or guests. Light spam guard: a hidden field and at most five requests an hour per email. Bot protection (Turnstile) is still open.
