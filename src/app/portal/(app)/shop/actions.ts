"use server";

import { type ActionResult, fail } from "@/lib/action-result";
import { getViewer } from "@/lib/auth";
import { priceOrder } from "@/lib/shop-cart";
import { createCheckout } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Turn a member's basket into an order and send them to Stripe to pay. The
 * prices come from the catalog and the member's own discount here on the
 * server; the basket from the browser only says what and how many.
 */
export async function startShopCheckout(lines: unknown): Promise<ActionResult & { url?: string }> {
  const v = await getViewer();
  if (!v.user || !v.memberId) return fail("Sign in as a member to order.");
  const admin = createAdminClient();
  if (!admin || !process.env.STRIPE_SECRET_KEY) return fail("Paying in the portal isn’t open yet.");

  const [{ data: catalog }, { data: pct }, { data: me }] = await Promise.all([
    v.supabase.rpc("shop_catalog"),
    v.supabase.rpc("my_court_discount"),
    v.supabase.rpc("my_member_profile").maybeSingle(),
  ]);
  const percent = Number(pct) || 0;
  const priced = priceOrder((catalog ?? []).map((c) => ({ ...c, price: Number(c.price) })), lines, percent);
  if (priced.error !== undefined) return fail(priced.error);
  if (priced.total <= 0) return fail("There’s nothing to pay.");

  const { data: order, error } = await admin
    .from("portal_shop_orders")
    .insert({
      contact_id: v.memberId,
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
      email: me?.email ?? null,
      meta: { order_id: order.id, name: me?.name ?? null, description: `Farm shop: ${count} item${count === 1 ? "" : "s"}` },
      cancelPath: "/portal/shop",
    });
    await admin.from("portal_shop_orders").update({ status: "pending" }).eq("id", order.id);
    return { ok: true, url };
  } catch {
    await admin.from("portal_shop_orders").update({ status: "cancelled" }).eq("id", order.id);
    return fail("We couldn’t open the payment page. Nothing was charged.");
  }
}
