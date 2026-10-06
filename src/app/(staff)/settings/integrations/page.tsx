import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { daysAgo, stripeLive } from "@/lib/stripe";

export const metadata: Metadata = { title: "Integrations" };

export default async function IntegrationsPage() {
  const { supabase } = await requireStaff("settings");
  const [{ data: ghl }, { count: linked }, { count: paid }] = await Promise.all([
    supabase.from("integrations").select("enabled, connected_at, last_sync_at, last_error").eq("key", "ghl").maybeSingle(),
    supabase.from("integration_links").select("contact_id", { count: "exact", head: true }).eq("provider", "ghl"),
    supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .gte("paid_at", daysAgo(30)),
  ]);
  const stripeOn = !!process.env.STRIPE_SECRET_KEY && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const stripeHook = !!process.env.STRIPE_WEBHOOK_SECRET;
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
        <Link href="/settings/integrations/stripe" className="card integ">
          <div className="top">
            <span className={`status-dot${stripeOn ? " on" : ""}`}>
              {!stripeOn ? "Not connected" : stripeLive() ? "On, live" : "On, test mode"}
            </span>
          </div>
          <h3>Stripe</h3>
          <p>
            Take payment online for day and week passes, membership terms and event tickets. Payments land in Finance
            and on the person’s profile.
          </p>
          <div className="meta">
            <span>{stripeOn ? `${paid ?? 0} payment${paid === 1 ? "" : "s"} in 30 days` : "Needs the Stripe keys"}</span>
            <span>{stripeOn && !stripeHook ? "Needs the webhook" : stripeOn ? "Manage" : "Set up"}</span>
          </div>
        </Link>
      </div>
      <p className="note">
        Integrations are managed by admins. Tokens and keys stay on the server; the browser never sees them.
      </p>
    </>
  );
}
