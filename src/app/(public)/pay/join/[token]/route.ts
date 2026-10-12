import { createCheckout, passStripePrice, stripeReady, TERM_NAME, termPrice } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

// The payment link staff email from Memberships → Add new member. It carries
// the person's pay token (not their pass token) and the tier to buy, and opens
// Stripe when it is clicked, so the link never expires like a Stripe session
// would. Passes (day, week) and membership terms are both handled; the
// membership or pass is created when the payment comes in.

export async function GET(request: Request, ctx: RouteContext<"/pay/join/[token]">) {
  const { token } = await ctx.params;
  const tierKey = new URL(request.url).searchParams.get("tier");
  const problem = (code: string) => Response.redirect(new URL(`/pay/done?problem=${code}`, request.url), 303);
  const admin = createAdminClient();
  if (!admin || !stripeReady()) return problem("off");

  const { data: c } = await admin
    .from("contacts")
    .select("id, name, email, rate, discount:discounts(percent, active)")
    .eq("pay_token", token)
    .maybeSingle();
  if (!c) return problem("member");
  if (!c.email) return problem("email");
  const { data: tier } = tierKey
    ? await admin
        .from("membership_tiers")
        .select("key, name, price, price_ff, currency, period, active, stripe_price_id")
        .eq("key", tierKey)
        .maybeSingle()
    : { data: null };
  if (!tier?.active) return problem("tier");

  try {
    if (tier.period === "day" || tier.period === "week") {
      const sp = await passStripePrice(admin, tier);
      if (!sp) return problem("tier");
      const url = await createCheckout({
        kind: "pass",
        title: tier.name,
        description: `Full access to The ARK, 8am to 8pm, ${tier.period === "week" ? "seven days in a row" : "one day"}. Starts at your first check-in; use within 90 days.`,
        priceId: sp.priceId,
        amount: sp.amount,
        currency: sp.currency,
        email: c.email,
        meta: { contact_id: c.id, tier: tier.key, name: c.name, email: c.email, description: tier.name },
        cancelPath: "/ark-membership",
      });
      return Response.redirect(url, 303);
    }
    const percent = c.discount?.active ? Number(c.discount.percent) : 0;
    const amount = termPrice(tier, c.rate, percent);
    if (!amount) return problem("tier");
    const url = await createCheckout({
      kind: "membership",
      title: `${tier.name} membership`,
      description: `Membership for ${TERM_NAME[tier.period]}${percent ? `, ${percent}% off` : ""}`,
      amount,
      currency: tier.currency,
      email: c.email,
      meta: {
        contact_id: c.id,
        tier: tier.key,
        name: c.name,
        email: c.email,
        description: `${tier.name} membership, ${TERM_NAME[tier.period]}`,
      },
      cancelPath: "/ark-membership",
    });
    return Response.redirect(url, 303);
  } catch (e) {
    console.error("Join checkout failed", e);
    return problem("stripe");
  }
}
