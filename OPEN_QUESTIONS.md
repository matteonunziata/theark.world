# Open questions

- **CRM visibility:** Division leads read all contacts but can't edit them; Sales see contacts they own or that sit in a pipeline they're assigned to. Confirm.
- **Who is the first admin?** We need your `@theark.world` email to add you as the first admin.
- **Bot protection for public event booking:** plan is Cloudflare Turnstile (free). Needs a site key.
- **Member directory opt-out:** names only for now. Should members be able to hide themselves?
- **Ticket emails:** sent from which address (e.g. `tickets@theark.world`)? Needs the domain verified in Resend.
- **Stripe:** one Stripe account for memberships and tickets? Test mode until launch.
- **Pause rules and pricing** (Founding 100,000 CRC, Standard 130,000 CRC, 200-member cap, Jungle Ventures 30% off) are in the handoff but not enforced anywhere yet; they belong with Stripe billing.
- **Spanish:** English first; copy is kept in components for now. Confirm when to add Spanish.
- **Sign-in email templates:** paste `supabase/templates/magic-link.html` and `confirm-signup.html` into Supabase → Authentication → Emails so sign-in emails match the ARK look. Also: is Supabase's built-in email sender still in use? It allows only a few sign-in emails an hour; a custom SMTP (Resend) lifts that.
- **Monthly memberships without a renewal date** are treated as valid while active. Should Founding/Standard members always have `renews_on` set, so a lapsed payment turns their pass red?
- **Hospitality guests:** do guests staying in a stewardship home get a gate pass for the length of their stay? Easy to add once confirmed.
- **Workflows with branches** (e.g. "if they replied, stop; otherwise send a nudge") need a different data model. Worth doing?
- **Who edits real estate:** admin, lead and sales for now. Should maintenance crew be able to add to a lot's maintenance log?
- **Founding tier:** kept as its own tier (50 spots) alongside the new terms. Is Founding now just "Monthly at the friends & family rate", or does it stay separate?
- **Keys to switch things on:** `RESEND_API_KEY` (all emails, incl. guest passes and booking confirmations), `SUPABASE_SERVICE_ROLE_KEY` (sign-in emails in the ARK look, team alerts for booking requests), `ANTHROPIC_API_KEY` (AI drafting). None are set in Vercel yet. Booking-request alerts go to the email in Settings → Organization.
- **Guest passes:** should staff be able to issue guest passes on a member's behalf, and do unused passes roll over? (Now: no rollover.)
- **Public stays:** take payment online (Stripe) at confirmation, or keep confirming by hand and sending a payment link?

## Round 8

- **Activity double counting.** If a ticket or stay booked in ARK OS is also entered as income in Finance and linked to the person, their total spent counts it twice. Do you want Finance income linked to a booking (so it's counted once), or is the hint in the drawer enough for now?
- **Original class photos.** The class photos came from screenshots and are small. Can you share the full-size originals, and a photo for Farm Volunteer Day?
- **Women and Men Circle** alternate weeks under one class. Split them into two classes, each with its own photo and description?
- **Ask AI scope.** Should Ask AI be on the members portal too (answering only about a member's own bookings and the schedule)? And should chats be saved?

## Round 9: Marketing

- **Sending domain and address.** Which address should marketing email come from (MARKETING_FROM)? The domain needs to be verified in Resend, with open and click tracking on.
- **Vercel plan.** On Hobby, scheduled campaigns and the automation run once a day at 7:00. Upgrade to Pro (or use Supabase pg_cron) to send every 15 minutes?
- **Where the waitlist form lives.** The signup page is `/join` on ARK OS. If theark.world (Squarespace) already has a waitlist form, should it post here instead, or link to `/join`?
- **Application form.** The automation links to https://theark.world/apply as a placeholder. What's the real application link?
- **Who's the strategist?** Add them in Settings → Team with the Marketing access level.

## Round 10: Facilitators

- **Facilitator emails.** Jordan, Jonathan, Stephanie and Alejandro have no email in Settings → Team, so they can't sign in yet. Add the email each of them uses.
- **Team sign-in by email link.** The sign-in hook still turns down new @theark.world accounts that use an email link ("Team members sign in with Google"), while the team sign-in page now offers an email link. That only affects staff signing in for the first time. Should the hook allow email links for anyone on the team?
- **Photos for check-in.** Members add their own photo. Should staff be able to add one from the CRM too (for members who never open the portal), and should a photo be required to join?
- **QR code destination.** Posters link to the class page, where members pick a date. Should scanning on the day go straight to today's session instead?

## Round 11: Integrations

- **GHL token.** Make a private integration in the sub-account (Settings → Private Integrations) with the contacts read and write scopes (locations read is optional, it only lets the page show the sub-account name), then paste it with the Location ID in Settings → Integrations → GoHighLevel. The search filter syntax for pulls follows GHL's docs but hasn't run against a live sub-account yet; if "Sync now" reports a problem on the way in, send me the message from Recent activity.
- **Which GHL fields matter?** Right now name, email, phone and source go out, and tags carry tier, status and pipeline stage. Should custom fields in GHL (lot, city, interests, renewal date) be filled too? And should a GHL pipeline mirror the memberships pipeline?
- **Leads from GHL.** New GHL contacts are added as plain contacts with no pipeline stage. Should they land on the membership waitlist (like `/join`), or get a stage from a GHL tag?
- **Conversations and calendars.** GHL also has SMS/WhatsApp conversations and calendars. Worth bringing messages into the CRM profile, or bookings into Schedule?
- **Sync timing.** Daily on Vercel Hobby. The webhook covers GHL → ARK OS right away; ARK OS → GHL is right away only after a CRM save (needs `SUPABASE_SERVICE_ROLE_KEY`). Fine, or upgrade to Pro for every 15 minutes?
