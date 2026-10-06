import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";

export const metadata: Metadata = { title: "Integrations" };

export default async function IntegrationsPage() {
  const { supabase } = await requireStaff("settings");
  const [{ data: ghl }, { count: linked }] = await Promise.all([
    supabase.from("integrations").select("enabled, connected_at, last_sync_at, last_error").eq("key", "ghl").maybeSingle(),
    supabase.from("integration_links").select("contact_id", { count: "exact", head: true }).eq("provider", "ghl"),
  ]);
  const connected = !!ghl?.connected_at;
  const status = !connected ? "Not connected" : ghl.enabled ? "On" : "Connected, paused";
  return (
    <>
      <div className="cards">
        <Link href="/settings/integrations/ghl" className="card integ">
          <div className="top">
            <span className={`status-dot${connected && ghl.enabled ? " on" : ""}`}>{status}</span>
          </div>
          <h3>GoHighLevel</h3>
          <p>
            Keep the CRM and your GHL sub-account in step: contacts, membership and pipeline tags, and leads that come in
            through GHL.
          </p>
          <div className="meta">
            <span>{connected ? `${linked ?? 0} contact${linked === 1 ? "" : "s"} linked` : "Needs a private integration token"}</span>
            <span>{ghl?.last_error ? "Needs attention" : connected ? "Manage" : "Set up"}</span>
          </div>
        </Link>
      </div>
      <p className="note">
        Integrations are managed by admins. Tokens stay on the server; the browser never sees them.
      </p>
    </>
  );
}
