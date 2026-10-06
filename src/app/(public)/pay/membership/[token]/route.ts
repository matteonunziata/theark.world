import { getViewer } from "@/lib/auth";
import { createCheckout, stripeReady, TERM_NAME, termPrice } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

// Pay for the next membership term on Stripe. Staff copy this link from the
// CRM profile (it carries the member's pass token); members use
// /pay/membership/me from the portal. The price is read when the link is
// opened: the member's tier, at their rate, less their discount. Paying
// activates the membership (or extends it from the renewal date).

export async function GET(request: Request, ctx: RouteContext<"/pay/membership/[token]">) {
  const { token } = await ctx.params;
  const fromPortal = token === "me";
  const problem = (code: string) => Response.redirect(new URL(`/pay/done?problem=${code}`, request.url), 303);
  const admin = createAdminClient();
  if (!admin || !stripeReady()) return problem("off");

  let q = admin
    .from("contacts")
    .select("id, name, email, tier, rate, discount:discounts(percent, active)");
  if (fromPortal) {
    const { memberId, user } = await getViewer();
    if (!user) return Response.redirect(new URL("/portal/login?next=/portal/me", request.url), 303);
    if (!memberId) return problem("member");
    q = q.eq("id", memberId);
  } else {
    q = q.eq("pass_token", token);
  }
  const { data: c } = await q.maybeSingle();
  if (!c) return problem("member");
  if (!c.email) return problem("email");
  const { data: tier } = c.tier
    ? await admin.from("membership_tiers").select("key, name, price, price_ff, currency, period").eq("key", c.tier).maybeSingle()
    : { data: null };
  const percent = c.discount?.active ? Number(c.discount.percent) : 0;
  const amount = tier ? termPrice(tier, c.rate, percent) : null;
  if (!tier || !amount || tier.key === "team") return problem("tier");

  try {
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
      cancelPath: fromPortal ? "/portal/me" : "/ark-membership",
    });
    return Response.redirect(url, 303);
  } catch (e) {
    console.error("Membership checkout failed", e);
    return problem("stripe");
  }
}
