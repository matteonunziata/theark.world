import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { siteUrl } from "@/lib/email";
import { byCode } from "@/lib/estate";
import { GuestyForm } from "./guesty-form";

export const metadata: Metadata = { title: "Guesty" };

export default async function GuestyPage() {
  const { supabase, staff } = await requireStaff("settings");
  const [{ data: i }, { data: listings }, { data: lots }, { count: stays }, { data: events }, origin] = await Promise.all([
    supabase.from("integrations").select("*").eq("key", "guesty").maybeSingle(),
    supabase.from("guesty_listings").select("*").order("title"),
    supabase
      .from("lots")
      .select("id, code, name, kind, in_hospitality, guesty_listing_id")
      .or("kind.eq.rental,in_hospitality.eq.true,guesty_listing_id.not.is.null"),
    supabase.from("stays").select("id", { count: "exact", head: true }).eq("source", "guesty"),
    supabase
      .from("integration_events")
      .select("id, direction, kind, ok, detail, created_at")
      .eq("provider", "guesty")
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
  // Secrets stay here; the page only learns whether they're saved.
  const { secret, access_token, token_expires_at, webhook_signing_secret, ...safe } = i;
  void access_token;
  void token_expires_at;
  return (
    <>
      <Link className="ev-back" href="/settings/integrations">← Integrations</Link>
      <GuestyForm
        integration={safe}
        hasSecret={!!secret}
        signed={!!webhook_signing_secret}
        listings={listings ?? []}
        lots={(lots ?? []).sort(byCode)}
        stays={stays ?? 0}
        events={events ?? []}
        webhookUrl={`${origin}/api/webhooks/guesty?key=${i.webhook_secret}`}
        webhookReady={!!process.env.SUPABASE_SERVICE_ROLE_KEY}
        canEdit={staff.role === "admin"}
      />
    </>
  );
}
