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

## Round 11: CSV import, membership page

- **Updating existing contacts on import.** Imports skip anyone whose email is already in the CRM. Should there be an option to fill in blank fields (phone, Instagram, location) on existing people instead?
- **Pass payments.** Day and Week Pass buttons use the MightySales payment links from the live site, so those purchases don't reach ARK OS. Move them to Stripe so they show up in Finance and the CRM?
- **Reviewing applications.** Applications land as a note and an Applied stage on the contact. Do you want an Applications list in Memberships, with approve and decline?
- **The live site's application** posts to a separate CRM (it tags people "Membership Applicant"). Once this page is live, should that one be switched off so applications only come here?
- **Membership page domain.** Should theark.world/ark-membership point at this page, and should the photos move off the main site's CDN?
- **Class categories.** The live schedule filters by Movement, Sports, Community, Farm and Dining. Classes have no category yet. Add one so the page can filter?
- **Dollar rate.** The USD view uses ₡505 per dollar. Keep a fixed rate, or pull a daily one?
- **Breakfast and lunch links are the same.** Both use https://site.theark.world/payment-link/6aabe11a9f7ff2c808a761bd. Is there a separate lunch link? It can be changed in Events → Lunch → Tickets.
- **Meal prices.** The meal tickets have no price, so the Pay button reads "Pay for breakfast". Add the prices so members see the amount before paying?
- **Checking the day pass.** Applicants say whether they've come on a day pass; ARK OS can't check it while passes are sold through the payment links. Fine as a self-declared answer for now?
