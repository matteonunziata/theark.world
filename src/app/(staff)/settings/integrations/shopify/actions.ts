"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, fail, field, friendly, ok } from "@/lib/action-result";
import { staffOrThrow } from "@/lib/auth";
import * as shopify from "@/lib/shopify";
import { normalizeShop } from "@/lib/shopify-map";
import { createAdminClient } from "@/lib/supabase/admin";

const refresh = () => revalidatePath("/settings/integrations", "layout");
const errorText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong talking to Shopify.");

export async function saveShopify(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin");
  const current = await shopify.getIntegration(supabase);
  if (!current) return fail("Couldn’t read the integration.");

  const shop = normalizeShop(field(data, "shop_domain") ?? "");
  const clientId = field(data, "client_id");
  const secret = field(data, "secret") ?? current.secret;
  const enabled = data.get("enabled") === "on";
  if (!shop) return fail("Enter the store’s myshopify.com address, like theark.myshopify.com.");
  if (!secret) return fail("Paste the client secret (or the Admin API access token).");

  // New credentials are checked before they're kept. Dev Dashboard apps trade
  // a client id and secret for a 24-hour token; older custom apps give a token.
  const changed =
    secret !== current.secret || shop !== current.shop_domain || (clientId ?? null) !== current.client_id || !current.connected_at;
  let token: { token: string; expiresAt: string | null } | null = null;
  let shopName = "";
  if (changed) {
    try {
      token = clientId ? await shopify.fetchToken(shop, clientId, secret) : { token: secret, expiresAt: null };
      const t = await shopify.testConnection(shop, token.token);
      shopName = t.name;
      if (t.missing.length) {
        const message = `The app is missing permissions in Shopify: ${t.missing.join(", ")}. Add them to the app’s access scopes, release a new version, and reinstall it on the store.`;
        await shopify.logEvent(supabase, { direction: "out", kind: "test", ok: false, detail: message });
        return fail(message);
      }
    } catch (e) {
      await shopify.logEvent(supabase, { direction: "out", kind: "test", ok: false, detail: errorText(e) });
      return fail(errorText(e));
    }
  }

  const { error } = await supabase
    .from("integrations")
    .update({
      shop_domain: shop,
      client_id: clientId,
      secret,
      enabled,
      ...(changed
        ? {
            connected_at: new Date().toISOString(),
            last_error: null,
            account_name: shopName,
            access_token: clientId ? (token?.token ?? null) : null,
            token_expires_at: clientId ? (token?.expiresAt ?? null) : null,
            // A different store has different segments and codes.
            ...(shop !== current.shop_domain ? { settings: {} } : {}),
          }
        : {}),
    })
    .eq("key", "shopify");
  if (error) return fail(friendly(error));
  if (changed) {
    await shopify.logEvent(supabase, { direction: "out", kind: "test", ok: true, detail: `Connected to ${shopName} (${shop}).` });
  }
  refresh();
  return ok(changed ? `Connected to ${shopName}` : "Settings saved");
}

export async function testShopify(): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin");
  const i = await shopify.getIntegration(supabase);
  if (!i?.secret || !i.shop_domain) return fail("Connect Shopify first.");
  try {
    let token = i.secret;
    if (i.client_id) {
      const t = await shopify.fetchToken(i.shop_domain, i.client_id, i.secret);
      token = t.token;
      await supabase.from("integrations").update({ access_token: t.token, token_expires_at: t.expiresAt }).eq("key", "shopify");
    }
    const t = await shopify.testConnection(i.shop_domain, token);
    if (t.missing.length) throw new Error(`The app is missing permissions in Shopify: ${t.missing.join(", ")}.`);
    await supabase.from("integrations").update({ last_error: null }).eq("key", "shopify");
    await shopify.logEvent(supabase, { direction: "out", kind: "test", ok: true, detail: `Reached ${t.name}.` });
    refresh();
    return ok(`Shopify is reachable (${t.name})`);
  } catch (e) {
    await shopify.logEvent(supabase, { direction: "out", kind: "test", ok: false, detail: errorText(e) });
    await supabase.from("integrations").update({ last_error: errorText(e) }).eq("key", "shopify");
    refresh();
    return fail(errorText(e));
  }
}

/** Make (or check) the two customer segments and the member10 and member20 codes. */
export async function setupShopifyDiscounts(): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin");
  const i = await shopify.getIntegration(supabase);
  if (!i?.secret || !i.shop_domain || !i.connected_at) return fail("Connect Shopify first.");
  try {
    const r = await shopify.setupDiscounts(supabase, { ...i, shop_domain: i.shop_domain, secret: i.secret });
    await supabase.from("integrations").update({ last_error: null }).eq("key", "shopify");
    refresh();
    return ok(r.made.length ? `Created ${r.made.join(" and ")} in Shopify` : "member10 and member20 are in place");
  } catch (e) {
    await shopify.logEvent(supabase, { direction: "out", kind: "sync", ok: false, detail: errorText(e) });
    await supabase.from("integrations").update({ last_error: errorText(e) }).eq("key", "shopify");
    refresh();
    return fail(errorText(e));
  }
}

export async function syncShopifyNow(): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin");
  // Saving orders and contacts is service-role only (like the nightly run); the admin check above is the gate.
  const r = await shopify.runSync(createAdminClient() ?? supabase);
  refresh();
  if ("error" in r) return fail(r.error);
  const parts = [`${r.members} member${r.members === 1 ? "" : "s"} with a discount today`, `${r.tagged} tagged`, `${r.untagged} untagged`];
  if (r.created) parts.push(`${r.created} new in Shopify`);
  if (r.noEmail) parts.push(`${r.noEmail} skipped, no email`);
  if (r.left) parts.push(`${r.left} left, sync again`);
  if (r.orders) parts.push(shopify.ordersLine(r.orders).replace(/\.$/, ""));
  if (r.errors.length) return fail(`Synced (${parts.join(", ")}), but ${r.errors.length} failed: ${r.errors[0]}`);
  return ok(`Synced: ${parts.join(", ")}`);
}

export async function disconnectShopify(): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin");
  const { error } = await supabase
    .from("integrations")
    .update({ secret: null, enabled: false, connected_at: null, last_error: null, access_token: null, token_expires_at: null, account_name: null })
    .eq("key", "shopify");
  if (error) return fail(friendly(error));
  refresh();
  return ok("Disconnected. Customers keep their tags and the codes keep working until they’re removed in Shopify.");
}
