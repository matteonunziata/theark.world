import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { daysAgo, stripeLive } from "@/lib/stripe";

export const metadata: Metadata = { title: "Integrations" };

export default async function IntegrationsPage() {
  const { supabase } = await requireStaff("settings");
  const [{ data: ghl }, { count: linked }, { data: guesty }, { count: homes }, { count: guestyStays }, { count: paid }, { data: slack }, { count: posted }, { data: shop }, { count: shopLinked }] = await Promise.all([
    supabase.from("integrations").select("enabled, connected_at, last_sync_at, last_error").eq("key", "ghl").maybeSingle(),
    supabase.from("integration_links").select("contact_id", { count: "exact", head: true }).eq("provider", "ghl"),
    supabase.from("integrations").select("enabled, connected_at, last_sync_at, last_error").eq("key", "guesty").maybeSingle(),
    supabase.from("lots").select("id", { count: "exact", head: true }).not("guesty_listing_id", "is", null),
    supabase.from("stays").select("id", { count: "exact", head: true }).eq("source", "guesty"),
    supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .gte("paid_at", daysAgo(30)),
    supabase.from("integrations").select("enabled, connected_at, last_error, account_name, rules").eq("key", "slack").maybeSingle(),
    supabase
      .from("integration_events")
      .select("id", { count: "exact", head: true })
      .eq("provider", "slack")
      .eq("ok", true)
      .in("kind", ["notify", "digest"])
      .gte("created_at", daysAgo(30)),
    supabase.from("integrations").select("enabled, connected_at, last_error, account_name").eq("key", "shopify").maybeSingle(),
    supabase.from("integration_links").select("contact_id", { count: "exact", head: true }).eq("provider", "shopify"),
  ]);
  const shopOn = !!shop?.connected_at;
  const slackOn = !!slack?.connected_at && slack.enabled;
  const slackKinds = Object.values((slack?.rules ?? {}) as Record<string, { on?: boolean }>).filter((r) => r?.on).length;
  const stripeOn = !!process.env.STRIPE_SECRET_KEY && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const stripeHook = !!process.env.STRIPE_WEBHOOK_SECRET;
  const connected = !!ghl?.connected_at;
  const status = !connected ? "Not connected" : ghl.enabled ? "On" : "Connected, paused";
  const guestyOn = !!guesty?.connected_at;
  const guestyStatus = !guestyOn ? "Not connected" : guesty.enabled ? "On" : "Connected, paused";
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
        <Link href="/settings/integrations/guesty" className="card integ">
          <div className="top">
            <span className={`status-dot${guestyOn && guesty.enabled ? " on" : ""}`}>{guestyStatus}</span>
          </div>
          <h3>Guesty</h3>
          <p>
            Bring reservations from Guesty (Airbnb, Booking.com and the booking site) into Hospitality as stays, link
            guests to the CRM, and block nights booked here on the Guesty calendar.
          </p>
          <div className="meta">
            <span>
              {guestyOn
                ? `${homes ?? 0} home${homes === 1 ? "" : "s"} linked, ${guestyStays ?? 0} stay${guestyStays === 1 ? "" : "s"}`
                : "Needs an Open API client"}
            </span>
            <span>{guesty?.last_error ? "Needs attention" : guestyOn ? "Manage" : "Set up"}</span>
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
        <Link href="/settings/integrations/slack" className="card integ">
          <div className="top">
            <span className={`status-dot${slackOn ? " on" : ""}`}>
              {!slack?.connected_at ? "Not connected" : slack.enabled ? "On" : "Connected, paused"}
            </span>
          </div>
          <h3>Slack</h3>
          <p>
            Hear about applications, bookings, payments and requests in the team’s Slack as they happen, and get a
            morning digest of the day ahead.
          </p>
          <div className="meta">
            <span>
              {slack?.connected_at
                ? `${slack.account_name ? `${slack.account_name} · ` : ""}${posted ?? 0} message${posted === 1 ? "" : "s"} in 30 days`
                : "Needs a Slack app’s bot token"}
            </span>
            <span>
              {slack?.last_error ? "Needs attention" : slackOn && !slackKinds ? "Nothing switched on" : slack?.connected_at ? "Manage" : "Set up"}
            </span>
          </div>
        </Link>
        <Link href="/settings/integrations/shopify" className="card integ">
          <div className="top">
            <span className={`status-dot${shopOn && shop.enabled ? " on" : ""}`}>
              {!shopOn ? "Not connected" : shop.enabled ? "On" : "Connected, paused"}
            </span>
          </div>
          <h3>Shopify</h3>
          <p>
            Give verified members their discount in the online shop: member10 for 1, 3 and 6 months, member20 for
            annual, valid only while the membership is.
          </p>
          <div className="meta">
            <span>
              {shopOn
                ? `${shop.account_name ? `${shop.account_name} · ` : ""}${shopLinked ?? 0} member${shopLinked === 1 ? "" : "s"} linked`
                : "Needs a Shopify app’s credentials"}
            </span>
            <span>{shop?.last_error ? "Needs attention" : shopOn ? "Manage" : "Set up"}</span>
          </div>
        </Link>
      </div>
      <p className="note">
        Integrations are managed by admins. Tokens and keys stay on the server; the browser never sees them.
      </p>
    </>
  );
}
