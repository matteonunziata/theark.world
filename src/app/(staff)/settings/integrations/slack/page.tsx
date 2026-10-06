import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { SlackForm } from "./slack-form";

export const metadata: Metadata = { title: "Slack" };

export default async function SlackPage() {
  const { supabase, staff } = await requireStaff("settings");
  const [{ data: i }, { data: events }, { count: posted }] = await Promise.all([
    supabase.from("integrations").select("*").eq("key", "slack").maybeSingle(),
    supabase
      .from("integration_events")
      .select("id, direction, kind, ok, detail, created_at")
      .eq("provider", "slack")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("integration_events")
      .select("id", { count: "exact", head: true })
      .eq("provider", "slack")
      .eq("ok", true)
      .in("kind", ["notify", "digest"]),
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
      <SlackForm
        integration={safe}
        hasToken={!!secret}
        posted={posted ?? 0}
        events={events ?? []}
        canEdit={staff.role === "admin"}
        serviceReady={!!process.env.SUPABASE_SERVICE_ROLE_KEY}
      />
    </>
  );
}
