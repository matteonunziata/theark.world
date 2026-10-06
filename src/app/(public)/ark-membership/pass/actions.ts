"use server";

import { redirect } from "next/navigation";
import { type ActionResult, fail, field } from "@/lib/action-result";
import { addDays, fmtDate, todayIn } from "@/lib/dates";
import { createCheckout, stripeReady } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Day and week passes: name, email and a first day, then Stripe Checkout. */
export async function buyPass(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  if (field(data, "website")) return fail("Couldn’t start the payment. Try again.");
  const plan = field(data, "plan");
  const name = field(data, "name")?.slice(0, 120);
  const email = field(data, "email")?.toLowerCase();
  const start = field(data, "start");
  const today = todayIn();
  if (plan !== "day" && plan !== "week") return fail("Choose a pass.");
  if (!name) return fail("Enter your name.");
  if (!email || !EMAIL.test(email)) return fail("Enter a valid email, so we can send you the pass.");
  if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start) || start < today || start > addDays(today, 60)) {
    return fail("Choose a day between today and two months from now.");
  }
  const admin = createAdminClient();
  if (!admin || !stripeReady()) return fail("Online payment isn’t open yet. Please pay at reception.");
  const { data: tier } = await admin
    .from("membership_tiers")
    .select("key, name, price, currency, active")
    .eq("key", plan)
    .maybeSingle();
  if (!tier?.active || !Number(tier.price)) return fail("This pass isn’t on sale right now.");

  const first = fmtDate(start, { weekday: "short", month: "short", day: "numeric" });
  const last = plan === "week" ? fmtDate(addDays(start, 6), { weekday: "short", month: "short", day: "numeric" }) : null;
  let url: string;
  try {
    url = await createCheckout({
      kind: "pass",
      title: `${tier.name}, ${last ? `${first} to ${last}` : first}`,
      description: "Full access to The ARK, 8am to 8pm",
      amount: Number(tier.price),
      currency: tier.currency,
      email,
      meta: {
        tier: tier.key,
        start_date: start,
        name,
        email,
        description: `${tier.name} from ${start}`,
      },
      cancelPath: `/ark-membership/pass/${plan}`,
    });
  } catch (e) {
    console.error("Pass checkout failed", e);
    return fail("Couldn’t open the payment page. Nothing was charged; try again in a minute.");
  }
  redirect(url);
}
