import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { siteUrl } from "@/lib/email";
import { GhlForm } from "./ghl-form";

export const metadata: Metadata = { title: "GoHighLevel" };

export default async function GhlPage() {
  const { supabase, staff } = await requireStaff("settings");
  const [{ data: i }, { count: linked }, { data: events }, origin] = await Promise.all([
    supabase.from("integrations").select("*").eq("key", "ghl").maybeSingle(),
    supabase.from("integration_links").select("contact_id", { count: "exact", head: true }).eq("provider", "ghl"),
    supabase
      .from("integration_events")
      .select("id, direction, kind, ok, detail, created_at")
      .eq("provider", "ghl")
      .order("created_at", { ascending: false })
      .limit(30),
    siteUrl(),
  ]);
  if (!i) {
    return (
      <>
        <Link className="ev-back" href="/settings/integrations">← Integrations</Link>
        <p className="note">Only admins can manage integrations.</p>
      </>
    );
  }
  // The token stays here; the page only learns whether one is saved.
  const { secret, ...safe } = i;
  return (
    <>
      <Link className="ev-back" href="/settings/integrations">← Integrations</Link>
      <GhlForm
        integration={safe}
        hasToken={!!secret}
        linked={linked ?? 0}
        events={events ?? []}
        webhookUrl={`${origin}/api/webhooks/ghl?key=${i.webhook_secret}`}
        webhookReady={!!process.env.SUPABASE_SERVICE_ROLE_KEY}
        canEdit={staff.role === "admin"}
      />
    </>
  );
}
