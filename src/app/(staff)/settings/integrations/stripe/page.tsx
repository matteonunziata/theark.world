import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { siteUrl } from "@/lib/email";
import { daysAgo, fmtAmount, stripeLive } from "@/lib/stripe";
import { CopyField } from "./copy-field";

export const metadata: Metadata = { title: "Stripe" };

const KIND: Record<string, string> = { pass: "Pass", membership: "Membership", ticket: "Ticket" };

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    timeZone: "America/Costa_Rica",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export default async function StripePage() {
  const { supabase, staff } = await requireStaff("settings");
  const since = daysAgo(30);
  const [{ data: payments }, origin] = await Promise.all([
    supabase
      .from("payments")
      .select("id, kind, status, name, email, description, amount, currency, refunded_amount, paid_at, live, contact_id")
      .order("paid_at", { ascending: false })
      .limit(50),
    siteUrl(),
  ]);
  const key = !!process.env.STRIPE_SECRET_KEY;
  const hook = !!process.env.STRIPE_WEBHOOK_SECRET;
  const service = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const on = key && service;
  const live = stripeLive();
  const recent = (payments ?? []).filter((p) => p.paid_at >= since && p.status === "paid");
  const totals: Record<string, number> = {};
  for (const p of recent) totals[p.currency] = (totals[p.currency] ?? 0) + Number(p.amount) - Number(p.refunded_amount);

  const check = (ok: boolean, label: string, hint: string) => (
    <li className={ok ? "" : "bad"}>
      <span className="tag-sm">{ok ? "Set" : "Missing"}</span>
      <span className="what">
        <b>{label}</b> {hint}
      </span>
    </li>
  );

  return (
    <>
      <Link className="ev-back" href="/settings/integrations">← Integrations</Link>
      <div className="integ-page">
        <div className="camp-head">
          <div>
            <h2>Stripe</h2>
            <span className={`status-dot${on ? " on" : ""}`}>
              {!on ? "Not connected" : live ? "On, live payments" : "On, test mode"}
            </span>
          </div>
        </div>

        <div className="kpis">
          <div className="kpi">
            <span>Last 30 days</span>
            <b>
              {Object.keys(totals).length
                ? Object.entries(totals).map(([c, n]) => fmtAmount(n, c)).join(" + ")
                : "—"}
            </b>
            <small>Paid online, after refunds</small>
          </div>
          <div className="kpi">
            <span>Payments</span>
            <b>{recent.length}</b>
            <small>Passes, memberships and tickets</small>
          </div>
          <div className="kpi">
            <span>Mode</span>
            <b>{!key ? "—" : live ? "Live" : "Test"}</b>
            <small>{live ? "Real cards are charged" : "Use card 4242 4242 4242 4242"}</small>
          </div>
        </div>

        <section className="panel">
          <div className="panel-h">
            <div>
              <h2>Set up</h2>
              <p className="muted" style={{ margin: "4px 0 0" }}>
                Stripe keys stay in the server’s environment (Vercel → Settings → Environment Variables), never in the
                database. Use the test keys until launch.
              </p>
            </div>
          </div>
          <ul className="integ-log checks">
            {check(key, "STRIPE_SECRET_KEY", "from Stripe → Developers → API keys (sk_test_… while testing).")}
            {check(service, "SUPABASE_SERVICE_ROLE_KEY", "lets ARK OS record a payment the moment Stripe confirms it.")}
            {check(hook, "STRIPE_WEBHOOK_SECRET", "the endpoint’s signing secret (whsec_…), from the webhook below.")}
          </ul>
          {!on && (
            <p className="note">
              Until the first two are set, day and week passes keep using the old payment links and tickets keep their
              “pay at the front desk” note.
            </p>
          )}
        </section>

        <section className="panel">
          <div className="panel-h">
            <div>
              <h2>Webhook</h2>
              <p className="muted" style={{ margin: "4px 0 0" }}>
                In Stripe → Developers → Webhooks, add an endpoint at this address and choose the events{" "}
                <code>checkout.session.completed</code>, <code>checkout.session.async_payment_succeeded</code> and{" "}
                <code>refund.created</code>. It records payments even when someone closes the page before coming back,
                and brings refunds into Finance.
              </p>
            </div>
          </div>
          <CopyField id="s-wh" label="Endpoint address" value={`${origin}/api/webhooks/stripe`} />
        </section>

        <section className="panel">
          <div className="panel-h">
            <div>
              <h2>Where payments show up</h2>
              <p className="muted" style={{ margin: "4px 0 0" }}>
                Each payment is added to Finance as income (Memberships, or Events &amp; experiences for tickets), on the
                person’s CRM profile, and here. A day or week pass starts the pass and emails it; a membership payment
                activates the membership or adds a term from the renewal date; a ticket is marked paid. Staff send
                membership links from the CRM profile (Payment link); members pay ahead from the portal.
              </p>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-h">
            <h2>Recent payments</h2>
          </div>
          {staff.role !== "admin" ? (
            <p className="muted">Only admins see payments here.</p>
          ) : !payments?.length ? (
            <p className="muted">Nothing yet.</p>
          ) : (
            <ul className="integ-log">
              {payments.map((p) => (
                <li key={p.id} className={p.status === "refunded" ? "bad" : ""}>
                  <span className="when">{when(p.paid_at)}</span>
                  <span className="tag-sm">
                    {KIND[p.kind] ?? p.kind}
                    {p.live ? "" : ", test"}
                  </span>
                  <span className="what">
                    {p.contact_id ? <Link href={`/crm/contact/${p.contact_id}`}>{p.name ?? p.email}</Link> : (p.name ?? p.email)}
                    {": "}
                    {p.description}, {fmtAmount(Number(p.amount), p.currency)}
                    {p.status === "refunded"
                      ? ", refunded"
                      : Number(p.refunded_amount) > 0
                        ? `, ${fmtAmount(Number(p.refunded_amount), p.currency)} refunded`
                        : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
