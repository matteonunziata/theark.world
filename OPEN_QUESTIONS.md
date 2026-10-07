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
- **Switch on the sign-in hook in Supabase.** `public.hook_before_user_created` isn't connected (Authentication → Hooks → Before User Created). The app now checks every email first, but a direct call to Supabase could still create a login with no access. Connecting the hook closes that. A test login, nobody-here@example.com, was created before the fix; delete it in Authentication → Users.
- **Team in member lists.** Staff now count as members, so they appear in Memberships with the Team tier and in the "members" marketing list. Keep them in the marketing list, or leave Team out of member emails?

## Round 12: Integrations

- **GHL token.** Make a private integration in the sub-account (Settings → Private Integrations) with the contacts read and write scopes (locations read is optional, it only lets the page show the sub-account name), then paste it with the Location ID in Settings → Integrations → GoHighLevel. The search filter syntax for pulls follows GHL's docs but hasn't run against a live sub-account yet; if "Sync now" reports a problem on the way in, send me the message from Recent activity.
- **Which GHL fields matter?** Right now name, email, phone and source go out, and tags carry tier, status and pipeline stage. Should custom fields in GHL (lot, city, interests, renewal date) be filled too? And should a GHL pipeline mirror the memberships pipeline?
- **Leads from GHL.** New GHL contacts are added as plain contacts with no pipeline stage. Should they land on the membership waitlist (like `/join`), or get a stage from a GHL tag?
- **Conversations and calendars.** GHL also has SMS/WhatsApp conversations and calendars. Worth bringing messages into the CRM profile, or bookings into Schedule?
- **Sync timing.** Daily on Vercel Hobby. The webhook covers GHL → ARK OS right away; ARK OS → GHL is right away only after a CRM save (needs `SUPABASE_SERVICE_ROLE_KEY`). Fine, or upgrade to Pro for every 15 minutes?

## Round 13: Members portal onboarding

- **Court payments.** Courts are an extra charge and still need Stripe. Until then the portal says court time is settled at reception. What's the price per slot (and per sport), and does the member discount apply to every tier? With a price on `courts` the portal could show it and, with Stripe, take payment at booking.
- **Welcome email trigger.** It fires when staff save an active membership of a month or longer in the CRM, because pass and membership purchases happen on MightySales links outside ARK OS. Once Stripe (or a GHL purchase webhook) brings purchases in, the same send can run on the purchase itself.
- **Magic link lifetime.** The welcome email's button is a Supabase magic link, which expires per the project's email OTP setting (one hour by default). Raise it in Supabase (Authentication → Email) to a day or so, since people open welcome emails later than sign-in emails.
- **WhatsApp numbers.** Members who were added before onboarding may have a phone in the CRM already; it becomes visible to other members as soon as they are open to connecting (the default). Should existing members be asked first, by setting `open_to_connect` to false until they finish onboarding?
- **Team members in the portal.** Staff and facilitators skip the onboarding gate but can fill the same fields under Me. Should they be asked too, so they show up with a photo and bio?

## Round 14: Farm shop

- **Shopify orders.** Online orders on thearkfarm.shop don't reach ARK OS, so the Overview is the till only. Pull Shopify orders in (Admin API token, like the GHL integration) so online and in-person sales sit in one report?
- **Shop sales into Finance.** Shop revenue isn't posted to the Finance ledger. A daily or weekly summary entry under the Farm shop business line, created automatically, or keep entering deposits by hand?
- **Member prices.** No product has a member price yet, so the member share on the Overview just shows who bought while an active member. Set member prices on the products that should have one (the drawer has the field).
- **Costs.** Products have no cost price, so there's no margin figure. Worth adding a cost per unit, at least for bought-in goods?
- **Till hardware.** Is the till a phone or a laptop at the counter? The Sales tab works on both, but a barcode scanner or a card reader would change what gets built next.

## Round 15: Stripe

- **Stripe account.** It's The Ark World, LLC (test mode for now). The test webhook `ark-os` points at https://theark-world.vercel.app/api/webhooks/stripe (API version 2026-09-30). A live-mode webhook is needed at launch. Which currency does it pay out in? Charges are made in colones.
- **Keys to switch it on.** In Vercel: `STRIPE_SECRET_KEY` (sk_test_… for now), `STRIPE_WEBHOOK_SECRET` (from the webhook in Stripe → Developers → Webhooks, address shown in Settings → Integrations → Stripe) and `SUPABASE_SERVICE_ROLE_KEY`. Also turn on "Email customers about successful payments" in Stripe so people get receipts.
- **Subscriptions or prepaid terms?** Memberships are paid one term at a time, from a link or the portal. Should Monthly renew automatically on the card instead? That needs Stripe Billing, plus decisions on cancelling, failed cards, and how pausing works.
- **Pause rules** are still not enforced. With prepaid terms, a pause is staff moving the renewal date. Fine?
- **MightySales links.** Once Stripe is live, the pass pages stop using them. Should the MightySales products be switched off then, so no one pays twice?
- **Pay before booking?** Paid event tickets still hold a spot unpaid (pay now, later, or at the desk). Should public events with a price require payment before the spot is held?
- **Meals, courts and stays** aren't on Stripe yet. Meals keep their payment links; courts have no price; stays are confirmed by hand. The same checkout can take any of them once prices are set.
- **Ambassador and Founding.** Ambassador has no price, so it gets no payment link. Founding is ₡100,000 a month at the rack rate. Is that still what Founding members pay?

## Round 16: Guesty

- **Open API access.** Guesty's Open API is a paid add-on on some plans. Settings → Integrations → Marketplace → Guesty Open API, create an application, and paste its client id and secret into Settings → Integrations → Guesty. Reading listings and reservations is enough for "Guesty → ARK OS"; "Both ways" needs calendar write access.
- **Field names are from the docs, not a live run.** The first "Sync now" will tell. If Recent activity shows a problem ("Guesty said: …"), send me the message. The two likely spots are the `filters` syntax on reservations and the shape of `money` and `guest`.
- **Publish the imported homes on /stay?** Now that Guesty's bookings block the calendar here, the eleven imported homes could be published, with requests from `/stay` landing as inquiries for the team to confirm (and "Both ways" blocking the nights in Guesty on confirmation). Or keep sending people to the Guesty booking site?
- **Date changes after a push.** With "Both ways", if a stay booked here moves to other dates after its nights were blocked in Guesty, the new nights are blocked but the old ones aren't freed (ARK OS doesn't keep the old range). Deleting a pushed stay doesn't free its nights either; cancel it first, sync, then delete. Worth keeping the pushed range to fix both?
- **Guest contacts.** Every Guesty guest with an email now becomes a CRM contact. Over a season that's a lot of one-time guests. Fine (they're a marketing list), or add them only as a stay and not as a contact?
- **Money.** Guesty's `totalPrice` is what the guest pays, in the listing currency. Only USD and CRC are kept; anything else leaves the total empty. Should the stay record the host payout (after channel fees) instead?
- **Webhook on the Hobby plan.** Guesty retries eight times over a day and disables an endpoint after five days of failures, so a long outage means re-registering from the Guesty page ("New address", then "Register in Guesty").


## Round 18: Memberships and the gate

- **One check-in a day for everyone.** "Passes can't be used twice" is applied to monthly and annual members too: a member who steps out for lunch and comes back scans red "Already checked in at 9:12 AM", and security waves them through by sight. Fine, or should members with a month or longer be re-admitted on the same day?
- **Two unused passes.** If someone holds an unused day pass and an unused week pass, the first check-in uses the one that expires first (then the day pass before the week pass). Tell me if you'd rather security chose.
- **Cached statuses.** The tier and status shown on CRM profiles, in GHL tags and in the Memberships list roll over at the daily cron (7:00). Gate and portal access never wait for it. On Vercel Pro the cron could run every 15 minutes.
- **The sign-in hook** is still not connected in Supabase (Authentication → Hooks → Before User Created → `public.hook_before_user_created`). Until it is, pass holders are only kept out of the portal by the app's own check.

## Round 18: Courts online

- **Prices.** ₡20,000 (padel) and ₡12,000 (pickleball) an hour are placeholders. What are the real rates, and is there an evening rate (lights) or a 90-minute price? Courts take any slot length; 90 minutes would need 30-minute slots on the court.
- **Unfilled open matches.** Playtomic cancels and refunds an open match that hasn't filled a few hours before it starts. Here the match stays on the court with whoever is in, each having paid only their share, so the club carries the gap. Options: let it run (today), auto-cancel at N hours before (needs a cron that runs more than once a day, so the Pro plan), or make the host pay the full court if it doesn't fill.
- **Refunds are by hand.** A cancellation within the rules doesn't refund on its own; someone refunds it in the Stripe dashboard and the webhook does the rest. Should ARK OS refund automatically on a within-policy cancellation (one Stripe API call per player)?
- **Hold that outlives its slot.** If someone takes more than 20 minutes to pay and the slot was taken in the meantime, the payment is still recorded, the booking stays expired, and a note is added to it for a refund. Stripe's Checkout page itself stays open for 24 hours, so a longer hold (or a Checkout `expires_at` of 30 minutes, Stripe's minimum) would shrink the window.
- **Levels never change.** Playtomic adjusts a rating from results. Recording scores and adjusting levels is a next step if open matches take off.
- **Members' discount when signed out.** The tier discount applies only when the member is signed in (the email field is then fixed to their membership email). A member who books signed out pays the full price. Fine, or should an email that matches an active member get the discount anyway?
- **Court bookers in the CRM.** Every visitor who books becomes a contact (source "Courts"), like Guesty guests. Keep, or add them only to the booking?
- **Meal products in Stripe.** The first meal payment looks for active one-time Stripe products named exactly "Breakfast" and "Lunch" (then by prefix). If the products are named differently, pick them once in Schedule → the class → Tickets → Stripe product. The 30-minute hold matches Stripe's shortest Checkout expiry; fine, or shorter for busy meals?


- **Shopify: should Founding and Ambassador get member10?** They have a 10% discount on their tier, so the sync tags them. Set the tier's discount to 0 in Memberships → Tiers to exclude one.
- **Shopify: should the codes combine with other discounts or exclude sale items?** They currently apply to everything and combine only with free shipping.

## Round 19: Importing past Stripe payments

- **Which business line?** Imported payments are sorted by keywords in their description, and anything unclear goes to Other. After the first import, look at Finance → Other: if many share a description, tell me and I'll add it to the rules.
- **Adding buyers to the CRM.** The import links payments to people already in the CRM and adds nobody. Should past buyers who aren't in the CRM be added as contacts (tagged "Stripe"), or kept out?
- **Fees on new payments.** Imported payments bring Stripe's fees into Finance; payments taken through ARK OS's checkout don't yet. Add them there too, so the monthly fee expense is complete?
- **Portal shop: should the catalog refresh by itself?** It only changes when someone runs "Sync from website" in the shop's Products tab, so a product that sells out in Shopify can still show in the portal until then. A nightly sync would fix that.
- **Portal shop: delivery?** Orders are pickup at The ARK only. Delivery would need an address, a fee or Shopify's shipping rates, and a decision on who delivers.
- **Portal shop: who is told to prepare the order?** A paid order shows in Slack's payments (if on), the shop ledger and Shopify (tagged `pickup`). A Slack message of its own, or a "ready for pickup" step, isn't built.
- **Portal shop: stock.** Orders decrement Shopify's stock, but the portal only learns of sell-outs at the next "Sync from website", and a member can pay for something that sold out in between. Nothing refunds automatically.

- Applications: a one-month application still requires having used a day pass first, but every applicant now gets a free one. Drop that requirement so they can apply, then visit on the free pass? Should approving or declining email the applicant?

## Finance currency toggle
- **Exchange rate.** It starts at ₡500 per $1, a placeholder. What rate should it use, and should it follow the bank's rate each month, or should each transaction keep the rate on its own date so past months stop moving?
