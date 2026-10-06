import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { ShopifyForm } from "./shopify-form";

export const metadata: Metadata = { title: "Shopify" };

export default async function ShopifyPage() {
  const { supabase, staff } = await requireStaff("settings");
  const [{ data: i }, { count: linked }, { data: events }, { data: tiers }] = await Promise.all([
    supabase.from("integrations").select("*").eq("key", "shopify").maybeSingle(),
    supabase.from("integration_links").select("contact_id", { count: "exact", head: true }).eq("provider", "shopify"),
    supabase
      .from("integration_events")
      .select("id, direction, kind, ok, detail, created_at")
      .eq("provider", "shopify")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("membership_tiers").select("key, name, period, court_discount").order("position"),
  ]);
  if (!i) {
    return (
      <>
        <Link className="ev-back" href="/settings/integrations">← Integrations</Link>
        <p className="note">Only admins can manage integrations.</p>
      </>
    );
  }
  // Secrets stay here; the page only learns whether they're saved.
  const { secret, access_token, token_expires_at, webhook_signing_secret, ...safe } = i;
  void access_token;
  void token_expires_at;
  void webhook_signing_secret;
  return (
    <>
      <Link className="ev-back" href="/settings/integrations">← Integrations</Link>
      <ShopifyForm
        integration={safe}
        hasSecret={!!secret}
        linked={linked ?? 0}
        events={events ?? []}
        tiers={(tiers ?? []).filter((t) => t.period !== "day" && t.period !== "week")}
        canEdit={staff.role === "admin"}
        cronReady={!!process.env.CRON_SECRET && !!process.env.SUPABASE_SERVICE_ROLE_KEY}
      />
    </>
  );
}
