import { createHmac, timingSafeEqual } from "node:crypto";
import { getIntegration, syncStockNow } from "@/lib/shopify";
import { createAdminClient } from "@/lib/supabase/admin";

// Shopify → ARK OS. Registered by the sync (Settings → Integrations → Shopify)
// for inventory_levels/update, so a stock change in Shopify reaches ARK OS
// within seconds. Signed with the app's client secret. Errors answer 500 and
// a run already going answers 503, so Shopify tries again.

export const maxDuration = 60;

export async function POST(request: Request) {
  const admin = createAdminClient();
  if (!admin) return new Response("Not configured", { status: 503 });
  const i = await getIntegration(admin);
  if (!i?.secret || !i.client_id) return new Response("Not configured", { status: 503 });

  const body = await request.text();
  const sent = request.headers.get("x-shopify-hmac-sha256") ?? "";
  const want = createHmac("sha256", i.secret).update(body).digest("base64");
  const a = Buffer.from(sent);
  const b = Buffer.from(want);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return new Response("Bad signature", { status: 401 });

  try {
    return (await syncStockNow(admin)) ? new Response("ok") : new Response("Busy", { status: 503 });
  } catch {
    return new Response("Sync failed", { status: 500 });
  }
}
