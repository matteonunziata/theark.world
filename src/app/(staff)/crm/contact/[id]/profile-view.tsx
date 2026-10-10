"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import { useDrawer } from "@/components/drawer";
import { useToast } from "@/components/toast";
import type { ActionResult } from "@/lib/action-result";
import {
  mstatusName,
  PIPELINES,
  ptypeName,
  tierClass,
  tierColor,
  tierName,
  tierPrice,
  waLink,
} from "@/lib/crm";
import { dayLabel, fmtDate, todayIn } from "@/lib/dates";
import { fmtMoney } from "@/lib/shop";
import { nextStep, stepDue } from "@/lib/sequences";
import { type Activity, ActivityPanel } from "./activity-panel";
import { addNote, enroll, replacePass, sendWelcome, setStage, updateEnrollment } from "../../actions";
import {
  type Contact,
  ContactDrawer,
  type DiscountOption,
  type Owner,
  type TierOption,
} from "../../contact-drawer";
import {
  type Enrollment,
  MessageDrawer,
  type Sequence,
} from "../../message-drawer";

type Note = { id: string; body: string; created_at: string; author: string | null };

type Membership = {
  id: string;
  tier: string;
  status: string;
  starts_on: string | null;
  ends_on: string | null;
  activate_by: string | null;
  source: string;
};

const MEMBERSHIP_STATUS: Record<string, string> = {
  unused: "Not used yet",
  active: "Active",
  paused: "Paused",
  cancelled: "Cancelled, runs to the end",
  revoked: "Ended early",
};

const SHOP_PAY: Record<string, string> = {
  tilopay_account: "Account (Tilopay)",
  bac_card: "Card (BAC)",
  sinpe: "SINPE",
  cash: "Cash",
};

export function ProfileView({
  contact: c,
  pay,
  notes,
  stages,
  enrollments,
  sequences,
  owners,
  tiers,
  discounts,
  activity,
  memberships,
  sales,
  properties,
  currency,
  now,
  role,
  orgName,
}: {
  contact: Contact;
  /** Stripe payment link for the next membership term, when Stripe is on. */
  pay: { url: string; label: string } | null;
  notes: Note[];
  stages: { pipeline: string; stage: string }[];
  enrollments: Enrollment[];
  sequences: Sequence[];
  owners: Owner[];
  tiers: TierOption[];
  discounts: DiscountOption[];
  activity: Activity[];
  memberships: Membership[];
  sales: {
    id: string;
    total: number;
    discount: number;
    created_at: string;
    items: { name: string; quantity: number }[];
    payments: { method: string }[];
  }[];
  currency: string;
  properties: { id: string; code: string; name: string | null }[];
  now: string;
  role: string;
  orgName: string;
}) {
  const tierRow = tiers.find((t) => t.key === c.tier);
  const disc = discounts.find((d) => d.id === c.discount_id);
  const toast = useToast();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [seqPick, setSeqPick] = useState("");
  const [editing, setEditing] = useState(false);
  const msg = useDrawer<{ e: Enrollment; seq: Sequence; i: number }>();
  const canEdit = role === "admin" || role === "sales";
  const today = todayIn();

  const run = (fn: () => Promise<ActionResult>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      toast(r.ok ? (r.message ?? "") : (r.error ?? ""));
      if (r.ok) after?.();
    });

  const stageOf = (p: string) => stages.find((s) => s.pipeline === p)?.stage ?? "";

  return (
    <>
      <Link className="ev-back" href="/crm/people">← People</Link>
      <div className="prof-head">
        <Avatar name={c.name} color={tierColor(c.tier)} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1>{c.name}</h1>
          <div className="sub">
            <span className="ptype">
              {ptypeName(c.type)}
              {c.type === "steward" && c.lot ? `, Lot ${c.lot}` : ""}
              {c.resident ? ", lives on-site" : ""}
            </span>
            <span className={`tier ${tierClass(c.tier)}`}>{tierName(c.tier)}</span>
            {c.tier && c.membership_status !== "active" && (
              <span className="ptype">{mstatusName(c.membership_status)}</span>
            )}
          </div>
        </div>
        {canEdit && (
          <button type="button" className="btn" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
      </div>

      <div className="prof-grid">
        <div>
          {properties.length > 0 && (
            <section className="panel">
              <h2>{properties.length > 1 ? "Properties" : "Property"}</h2>
              {properties.map((l) => (
                <p key={l.id} style={{ margin: "0 0 6px" }}>
                  <Link href={`/estate/${l.id}`}>{l.name ? `${l.name} (Lot ${l.code})` : `Lot ${l.code}`}</Link>
                </p>
              ))}
            </section>
          )}
          <ActivityPanel items={activity} currency={currency} now={now} />
          <section className="panel">
            <h2>Notes</h2>
            {canEdit && (
              <div className="addnote">
                <textarea
                  aria-label="New note"
                  placeholder="Add a note: what you talked about, what they need, what’s next"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <button
                  type="button"
                  className="btn primary"
                  disabled={pending || !note.trim()}
                  onClick={() => run(() => addNote(c.id, note), () => setNote(""))}
                >
                  Add
                </button>
              </div>
            )}
            <div className="notes" style={{ marginTop: 12 }}>
              {notes.length ? (
                notes.map((n) => (
                  <div className="n" key={n.id}>
                    <time>
                      {new Date(n.created_at).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      {n.author ? `, ${n.author}` : ""}
                    </time>
                    <p>{n.body}</p>
                  </div>
                ))
              ) : (
                <p className="muted" style={{ margin: 0 }}>No notes yet.</p>
              )}
            </div>
          </section>

          <section className="panel">
            <h2>Workflows</h2>
            {enrollments.length ? (
              enrollments.map((e) => {
                const seq = sequences.find((s) => s.id === e.sequence_id);
                if (!seq) return null;
                const next = nextStep(seq.steps, e.sent);
                const line =
                  e.status === "stopped"
                    ? "Stopped"
                    : next === -1 || e.status === "completed"
                      ? "Completed"
                      : `Step ${next + 1} of ${seq.steps.length} due ${dayLabel(
                          stepDue(e.started_on, seq.steps, next),
                          today,
                        ).toLowerCase()}`;
                return (
                  <div className="enr" key={e.id}>
                    <b><Link href={`/crm/workflows/${seq.id}`} style={{ color: "inherit" }}>{seq.name}</Link></b>
                    <span>
                      {e.sent.length} of {seq.steps.length} sent. {line}.
                    </span>
                    {canEdit && (
                      <div className="acts">
                        {e.status === "active" && next >= 0 ? (
                          <>
                            <button
                              type="button"
                              className="btn"
                              onClick={() => msg.openItem({ e, seq, i: next })}
                            >
                              Open step {next + 1}
                            </button>
                            <button
                              type="button"
                              className="btn"
                              disabled={pending}
                              onClick={() => run(() => updateEnrollment(e.id, "stop"))}
                            >
                              Stop
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="btn"
                            disabled={pending}
                            onClick={() => run(() => updateEnrollment(e.id, "remove"))}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="muted" style={{ margin: 0 }}>Not enrolled in any workflow.</p>
            )}
            {canEdit &&
              (sequences.length ? (
                <div className="enroll">
                  <select
                    aria-label="Workflow"
                    value={seqPick}
                    onChange={(e) => setSeqPick(e.target.value)}
                  >
                    <option value="">Enroll in a workflow…</option>
                    {sequences.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn"
                    disabled={pending || !seqPick}
                    onClick={() => run(() => enroll(c.id, seqPick), () => setSeqPick(""))}
                  >
                    Enroll
                  </button>
                </div>
              ) : (
                <p className="note" style={{ marginTop: 10 }}>
                  No sequences yet. <Link href="/crm/sequences">Create one</Link>.
                </p>
              ))}
          </section>
        </div>

        <div>
          <section className="panel">
            <h2>Contact</h2>
            <dl className="kv">
              <dt>Email</dt>
              <dd>{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : "—"}</dd>
              <dt>WhatsApp</dt>
              <dd>
                {c.phone ? (
                  <a href={waLink(c.phone)} target="_blank" rel="noopener noreferrer">
                    {c.phone}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
              <dt>Instagram</dt>
              <dd>
                {c.instagram ? (
                  <a
                    href={`https://instagram.com/${c.instagram.replace("@", "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {c.instagram}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
              <dt>Based in</dt>
              <dd>{c.location || "—"}</dd>
              <dt>How we met</dt>
              <dd>{c.source || "—"}</dd>
              <dt>Owner</dt>
              <dd>{owners.find((o) => o.id === c.owner_id)?.name ?? "—"}</dd>
              {c.tier && (
                <>
                  <dt>Pays</dt>
                  <dd>
                    {tierPrice(tierRow, disc?.percent, c.rate)}
                    {c.rate === "ff" ? ", friends & family" : ""}
                    {disc ? ` (${disc.name}, ${Number(disc.percent)}% off)` : ""}
                  </dd>
                  <dt>Member since</dt>
                  <dd>
                    {c.member_since
                      ? fmtDate(c.member_since, { month: "short", day: "numeric", year: "numeric" })
                      : "—"}
                  </dd>
                  <dt>{tierRow?.period === "day" || tierRow?.period === "week" ? "Valid until" : "Renews"}</dt>
                  <dd>
                    {c.renews_on
                      ? fmtDate(c.renews_on, { month: "short", day: "numeric", year: "numeric" })
                      : "—"}
                  </dd>
                  <dt>Pass</dt>
                  <dd>
                    <a href={`/p/${c.pass_token}?look=1`} target="_blank" rel="noreferrer">Open member pass</a>
                    {canEdit && (
                      <>
                        <br />
                        <button
                          type="button"
                          className="btn"
                          style={{ marginTop: 6 }}
                          disabled={pending}
                          onClick={() => {
                            if (confirm("Make a new pass code? The old QR stops working at once.")) run(() => replacePass(c.id));
                          }}
                        >
                          Replace pass code
                        </button>
                      </>
                    )}
                  </dd>
                  {pay && canEdit && (
                    <>
                      <dt>Payment link</dt>
                      <dd>
                        {pay.label}
                        <br />
                        <span style={{ display: "inline-flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="btn"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(pay.url);
                                toast("Payment link copied");
                              } catch {
                                toast("Couldn’t copy. Open the link and copy it from the address bar.");
                              }
                            }}
                          >
                            Copy link
                          </button>
                          {c.phone && (
                            <a
                              className="btn"
                              href={waLink(
                                c.phone,
                                `Hi ${c.name.split(/\s+/)[0]}, here is the link to pay for your ARK membership (${pay.label}): ${pay.url}`,
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Send on WhatsApp
                            </a>
                          )}
                        </span>
                        <span className="hint" style={{ display: "block", marginTop: 4 }}>
                          Paying activates the membership, or adds a term from the renewal date.
                        </span>
                      </dd>
                    </>
                  )}
                  <dt>Portal</dt>
                  <dd>
                    {c.onboarded_at
                      ? `Profile set up ${fmtDate(c.onboarded_at.slice(0, 10), { month: "short", day: "numeric" })}`
                      : c.welcome_sent_at
                        ? `Welcome email sent ${fmtDate(c.welcome_sent_at.slice(0, 10), { month: "short", day: "numeric" })}, not set up yet`
                        : "Not welcomed yet"}
                    {canEdit && c.email && c.membership_status === "active" && (
                      <>
                        <br />
                        <button
                          type="button"
                          className="btn"
                          style={{ marginTop: 6 }}
                          disabled={pending}
                          onClick={() => run(() => sendWelcome(c.id))}
                        >
                          {c.welcome_sent_at ? "Resend welcome email" : "Send welcome email"}
                        </button>
                      </>
                    )}
                  </dd>
                </>
              )}
            </dl>
            {memberships.length > 0 && (
              <>
                <h3 style={{ margin: "16px 0 6px", fontSize: 13, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--muted)" }}>
                  Memberships and passes
                </h3>
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
                  {memberships.map((m) => {
                    const f = (d: string) => fmtDate(d, { month: "short", day: "numeric", year: "numeric" });
                    const when = m.starts_on
                      ? m.ends_on && m.ends_on !== m.starts_on
                        ? `${f(m.starts_on)} to ${f(m.ends_on)}`
                        : m.ends_on
                          ? f(m.starts_on)
                          : `from ${f(m.starts_on)}`
                      : m.activate_by
                        ? `use by ${f(m.activate_by)}`
                        : "";
                    return (
                      <li key={m.id} style={{ fontSize: 14, display: "flex", gap: 8, flexWrap: "wrap", opacity: m.status === "revoked" ? 0.6 : 1 }}>
                        <span className={`tier ${tierClass(m.tier)}`}>{tierName(m.tier)}</span>
                        <span>{when}</span>
                        <span className="muted">
                          {MEMBERSHIP_STATUS[m.status] ?? m.status}
                          {m.source === "stripe" ? ", paid on Stripe" : m.source === "team" ? ", team" : ""}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>
          {sales.length > 0 && (
            <section className="panel">
              <h2>Farm shop purchases</h2>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
                {sales.map((s) => (
                  <li key={s.id} style={{ fontSize: 14 }}>
                    <b>{fmtMoney(Number(s.total))}</b>
                    <span className="muted">
                      {" "}
                      · {fmtDate(s.created_at.slice(0, 10), { month: "short", day: "numeric", year: "numeric" })} ·{" "}
                      {s.payments.map((p) => SHOP_PAY[p.method] ?? p.method).join(", ")}
                      {Number(s.discount) > 0 ? ` · saved ${fmtMoney(Number(s.discount))}` : ""}
                    </span>
                    <div className="muted">
                      {s.items.map((i) => `${i.name}${Number(i.quantity) !== 1 ? ` × ${Number(i.quantity)}` : ""}`).join(", ")}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="panel">
            <h2>Interests</h2>
            <div className="tags">
              {c.interests.length ? (
                c.interests.map((i) => <span className="tag" key={i}>{i}</span>)
              ) : (
                <span className="muted">None recorded</span>
              )}
            </div>
          </section>
          <section className="panel">
            <h2>Pipelines</h2>
            <div className="stage-sel">
              {Object.entries(PIPELINES).map(([k, p]) => (
                <span key={k} style={{ display: "contents" }}>
                  <label htmlFor={`st-${k}`}>{p.name}</label>
                  <select
                    id={`st-${k}`}
                    value={stageOf(k)}
                    disabled={!canEdit || pending}
                    onChange={(e) => run(() => setStage(c.id, k, e.target.value || null))}
                  >
                    <option value="">Not in pipeline</option>
                    {p.stages.map(([sk, sl]) => (
                      <option key={sk} value={sk}>{sl}</option>
                    ))}
                  </select>
                </span>
              ))}
            </div>
          </section>
        </div>
      </div>

      <ContactDrawer
        open={editing}
        contact={c}
        owners={owners}
        tiers={tiers}
        discounts={discounts}
        isAdmin={role === "admin"}
        canEdit={canEdit}
        onClose={() => setEditing(false)}
      />
      {msg.item && (
        <MessageDrawer
          key={`${msg.item.e.id}-${msg.item.i}`}
          open={msg.open}
          contact={c}
          orgName={orgName}
          {...msg.item}
          onClose={msg.close}
        />
      )}
    </>
  );
}
