"use server";

import { redirect } from "next/navigation";
import { type ActionResult, fail, field } from "@/lib/action-result";
import { createCheckout, stripeReady } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Day and week passes: name and email, then Stripe Checkout. No date: the
 * pass starts at the first check-in at the gate and must be used within 90
 * days (user decision, 2026-10-05).
 */
export async function buyPass(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  if (field(data, "website")) return fail("Couldn’t start the payment. Try again.");
  const plan = field(data, "plan");
  const name = field(data, "name")?.slice(0, 120);
  const email = field(data, "email")?.toLowerCase();
  if (plan !== "day" && plan !== "week") return fail("Choose a pass.");
  if (!name) return fail("Enter your name.");
  if (!email || !EMAIL.test(email)) return fail("Enter a valid email, so we can send you the pass.");
  const admin = createAdminClient();
  if (!admin || !stripeReady()) return fail("Online payment isn’t open yet. Please pay at reception.");
  const { data: tier } = await admin
    .from("membership_tiers")
    .select("key, name, price, currency, active")
    .eq("key", plan)
    .maybeSingle();
  if (!tier?.active || !Number(tier.price)) return fail("This pass isn’t on sale right now.");

  let url: string;
  try {
    url = await createCheckout({
      kind: "pass",
      title: tier.name,
      description: `Full access to The ARK, 8am to 8pm, ${plan === "week" ? "seven days in a row" : "one day"}. Starts at your first check-in; use within 90 days.`,
      amount: Number(tier.price),
      currency: tier.currency,
      email,
      meta: {
        tier: tier.key,
        name,
        email,
        description: tier.name,
      },
      cancelPath: `/ark-membership/pass/${plan}`,
    });
  } catch (e) {
    console.error("Pass checkout failed", e);
    return fail("Couldn’t open the payment page. Nothing was charged; try again in a minute.");
  }
  redirect(url);
}
