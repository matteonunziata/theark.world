import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { pushOrder } from "@/lib/shopify";

type Admin = SupabaseClient<Database>;

/**
 * A portal shop order that Stripe says is paid: settle it once (stock ledger),
 * then send it to Shopify. The webhook and the return page can both get here;
 * only the first one creates anything.
 */
export async function settleShopOrder(admin: Admin, orderId: string, session: { id: string; intent: string | null }) {
  const { data, error } = await admin
    .rpc("record_shop_order_paid", { p_order: orderId, p_session: session.id, p_intent: session.intent ?? "" })
    .single();
  if (error || !data) throw new Error(`Couldn’t record shop order ${orderId}: ${error?.message ?? "no result"}`);
  if (data.created) await pushOrder(admin, orderId);
  const { data: o } = await admin.from("portal_shop_orders").select("total, currency").eq("id", orderId).maybeSingle();
  return { created: data.created, contactId: data.contact_id, total: Number(o?.total ?? 0), currency: o?.currency ?? "CRC" };
}
