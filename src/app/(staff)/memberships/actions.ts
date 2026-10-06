"use server";

import { revalidatePath } from "next/cache";
import {
  type ActionResult,
  fail,
  field,
  friendly,
  ok,
} from "@/lib/action-result";
import { staffOrThrow } from "@/lib/auth";
import { listStripePrices } from "@/lib/stripe";

const PERIODS = ["day", "week", "month", "quarter", "half", "year", "once"];

export async function saveTier(
  _prev: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin");
  const existing = field(data, "key");
  const name = field(data, "name");
  if (!name) return fail("Enter a name.");

  if (data.get("intent") === "delete" && existing) {
    const { error } = await supabase.from("membership_tiers").delete().eq("key", existing);
    if (error) return fail(friendly(error));
    revalidatePath("/memberships", "layout");
    return ok("Tier removed");
  }

  const price = field(data, "price");
  const priceFf = field(data, "price_ff");
  const spots = Number(field(data, "spots") ?? 0);
  const period = field(data, "period") ?? "month";
  const row = {
    name,
    price: price === null ? null : Math.max(0, Number(price)),
    price_ff: priceFf === null ? null : Math.max(0, Number(priceFf)),
    guest_passes: Math.max(0, Math.min(99, Math.floor(Number(field(data, "guest_passes") ?? 0)) || 0)),
    court_discount: Math.max(0, Math.min(100, Number(field(data, "court_discount") ?? 0) || 0)),
    currency: field(data, "currency") === "USD" ? "USD" : "CRC",
    period: PERIODS.includes(period) ? period : "month",
    spots: spots > 0 ? spots : null,
    description: field(data, "description"),
    pause_rule: field(data, "pause_rule"),
    perks: (field(data, "perks") ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
    active: data.get("active") !== "no",
  };
  // A Stripe product sets the price; the amount shown everywhere is Stripe's.
  const stripePriceId = field(data, "stripe_price_id");
  if (stripePriceId) {
    const sp = (await listStripePrices().catch(() => [])).find((x) => x.priceId === stripePriceId);
    if (!sp) return fail("That Stripe product isn’t available any more. Pick another.");
    row.price = sp.amount;
    row.currency = sp.currency === "USD" ? "USD" : "CRC";
  }
  const { error } = existing
    ? await supabase.from("membership_tiers").update({ ...row, stripe_price_id: stripePriceId }).eq("key", existing)
    : await supabase.from("membership_tiers").insert({
        ...row,
        stripe_price_id: stripePriceId,
        key: name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "tier",
        position: 99,
      });
  if (error) {
    if (error.code === "23505") return fail("A tier with that name already exists.");
    return fail(friendly(error));
  }
  revalidatePath("/memberships", "layout");
  revalidatePath("/crm", "layout");
  return ok(existing ? "Tier saved" : `${name} added`);
}

export async function saveDiscount(
  _prev: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin");
  const id = field(data, "id");
  if (data.get("intent") === "delete" && id) {
    const { error } = await supabase.from("discounts").delete().eq("id", id);
    if (error) return fail(friendly(error));
    revalidatePath("/memberships", "layout");
    return ok("Discount removed");
  }
  const name = field(data, "name");
  const percent = Number(field(data, "percent") ?? 0);
  if (!name) return fail("Enter a name.");
  if (!(percent > 0 && percent <= 100)) return fail("Enter a percentage between 1 and 100.");
  const row = {
    name,
    percent,
    lifetime: data.get("lifetime") === "yes",
    description: field(data, "description"),
    active: data.get("active") !== "no",
  };
  const { error } = id
    ? await supabase.from("discounts").update(row).eq("id", id)
    : await supabase.from("discounts").insert(row);
  if (error) return fail(friendly(error));
  revalidatePath("/memberships", "layout");
  revalidatePath("/crm", "layout");
  return ok(id ? "Discount saved" : `${name} added`);
}
