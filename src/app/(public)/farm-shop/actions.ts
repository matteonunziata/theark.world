"use server";

import { type ActionResult, fail } from "@/lib/action-result";
import { getViewer } from "@/lib/auth";
import { priceOrder } from "@/lib/shop-cart";
import { createCheckout } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Turn a basket from the public Farm shop into an order and send the buyer to
 * Stripe. No sign-in needed: a guest gives a name and email. A signed-in member
 * gets their own discount. Prices come from the catalog here on the server.
 */
export async function startPublicShopCheckout(
  lines: unknown,
  buyer: { name: string; email: string },
): Promise<ActionResult & { url?: string }> {
  const v = await getViewer();
  const admin = createAdminClient();
  if (!admin || !process.env.STRIPE_SECRET_KEY) return fail("Paying online isn’t open yet.");

  const [{ data: catalog }, { data: pct }, { data: me }] = await Promise.all([
    v.supabase.rpc("public_shop_catalog"),
    v.memberId ? v.supabase.rpc("my_shop_discount") : Promise.resolve({ data: 0 }),
    v.memberId ? v.supabase.rpc("my_member_profile").maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const member = !!v.memberId;
  const name = (member ? me?.name : buyer?.name)?.trim() ?? "";
  const email = (member ? me?.email : buyer?.email)?.trim() ?? "";
  if (!name) return fail("Add your name.");
  if (!EMAIL.test(email) || email.length > 200) return fail("Add the email we should send your receipt to.");

  const percent = Number(pct) || 0;
  const priced = priceOrder((catalog ?? []).map((c) => ({ ...c, price: Number(c.price) })), lines, percent);
  if (priced.error !== undefined) return fail(priced.error);
  if (priced.total <= 0) return fail("There’s nothing to pay.");

  const { data: order, error } = await admin
    .from("portal_shop_orders")
    .insert({
      contact_id: member ? v.memberId : null,
      guest_name: member ? null : name.slice(0, 120),
      guest_email: member ? null : email.toLowerCase(),
      lines: priced.lines,
      subtotal: priced.subtotal,
      discount_percent: percent,
      total: priced.total,
      currency: "CRC",
    })
    .select("id")
    .single();
  if (error || !order) return fail("Couldn’t start your order. Try again.");

  const count = priced.lines.reduce((n, l) => n + l.qty, 0);
  try {
    const url = await createCheckout({
      kind: "shop",
      title: "The ARK Farm shop",
      description: `${count} item${count === 1 ? "" : "s"}, pick up at The ARK${percent ? `. Member discount ${percent}% included` : ""}`,
      amount: priced.total,
      currency: "CRC",
      email,
      meta: { order_id: order.id, name, web: "1", description: `Farm shop: ${count} item${count === 1 ? "" : "s"}` },
      cancelPath: "/farm-shop",
    });
    return { ok: true, url };
  } catch {
    await admin.from("portal_shop_orders").update({ status: "cancelled" }).eq("id", order.id);
    return fail("We couldn’t open the payment page. Nothing was charged.");
  }
}
