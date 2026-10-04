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
