import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { brandParam, fmtCr, LISTS, listName, pct } from "@/lib/marketing";
import { marketingEmailReady } from "@/lib/marketing-email";
import { BrandTags } from "../nav";
import { NewCampaign } from "./new-campaign";

export const metadata: Metadata = { title: "Email" };

export default async function EmailPage({ searchParams }: PageProps<"/marketing/email">) {
  const brand = brandParam((await searchParams).brand);
  const { supabase } = await requireStaff("marketing");
  let campaigns = supabase
    .from("email_campaigns")
    .select("*, email_sends(status, opened_at, clicked_at, unsubscribed_at)")
    .order("created_at", { ascending: false });
  if (brand) campaigns = campaigns.contains("brands", [brand]);
  const [{ data: rows }, lists, { data: auto }, { data: autoSends }] = await Promise.all([
    campaigns,
    Promise.all(LISTS.map(([k]) => supabase.rpc("marketing_list", { p_list: k }))),
    supabase.from("email_automations").select("*").eq("key", "waitlist").maybeSingle(),
    supabase.from("email_sends").select("automation_step").not("automation_step", "is", null).eq("status", "sent"),
  ]);

  return (
    <>
      {!marketingEmailReady() && (
        <div className="banner">
          Email isn’t connected yet. Campaigns can be written and scheduled, but nothing sends until
          RESEND_API_KEY is set. See DECISIONS.md for the setup.
        </div>
      )}
      <div className="mk-lists">
        {LISTS.map(([k, n, d], i) => {
          const people = lists[i].data ?? [];
          return (
            <div className="kpi" key={k}>
              <span>{n}</span>
              <b>{people.length}</b>
              <small>{d}</small>
            </div>
          );
        })}
      </div>

      <section className="panel">
        <div className="panel-h">
          <h2>Campaigns</h2>
          <NewCampaign brand={brand} />
        </div>
        {rows?.length ? (
          <div className="mk-table">
            <div className="mk-tr head">
              <span>Campaign</span>
              <span>List</span>
              <span>Status</span>
              <span>Sent</span>
              <span>Opened</span>
              <span>Clicked</span>
            </div>
            {rows.map((c) => {
              const real = c.email_sends.filter((s) => s.status === "sent");
              return (
                <Link key={c.id} href={`/marketing/email/${c.id}`} className="mk-tr">
                  <span className="name">
                    <b>{c.name}</b>
                    <BrandTags brands={c.brands} />
                  </span>
                  <span>{listName(c.list_key)}</span>
                  <span>
                    {c.status === "sent" && c.sent_at
                      ? `Sent ${fmtCr(c.sent_at, { month: "short", day: "numeric" })}`
                      : c.status === "scheduled" && c.scheduled_at
                        ? `Scheduled ${fmtCr(c.scheduled_at, { month: "short", day: "numeric" })}`
                        : c.status === "sending"
                          ? "Sending"
                          : "Draft"}
                  </span>
                  <span>{real.length || "—"}</span>
                  <span>{real.length ? pct(real.filter((s) => s.opened_at).length, real.length) : "—"}</span>
                  <span>{real.length ? pct(real.filter((s) => s.clicked_at).length, real.length) : "—"}</span>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="muted" style={{ margin: 0 }}>No campaigns{brand ? " for this brand" : ""} yet.</p>
        )}
      </section>

      <section className="panel">
        <div className="panel-h">
          <h2>Automation</h2>
          <Link className="btn" href="/marketing/email/automation">Edit</Link>
        </div>
        <p style={{ margin: 0 }}>
          <b>{auto?.name ?? "Waitlist welcome"}</b>{" "}
          <span className={`status-dot ${auto?.active ? "on" : ""}`}>{auto?.active ? "On" : "Off"}</span>
        </p>
        <p className="muted" style={{ margin: "6px 0 0" }}>
          Someone joins the waitlist at <Link href="/join">/join</Link> → welcome email right away → the
          application link {auto?.followup_days ?? 3} days later.{" "}
          {(autoSends ?? []).filter((s) => s.automation_step === "welcome").length} welcomes and{" "}
          {(autoSends ?? []).filter((s) => s.automation_step === "followup").length} application emails sent so far.
        </p>
      </section>
    </>
  );
}
