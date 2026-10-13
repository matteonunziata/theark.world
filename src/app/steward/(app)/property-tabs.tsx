"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import type { Database } from "@/lib/database.types";
import { fmtDate } from "@/lib/dates";
import { label, MAINT_CATEGORIES } from "@/lib/estate";
import { money } from "@/lib/schedule";
import { addPropertyNote, decideBudget, deletePropertyNote, requestWork, saveMyNotes } from "./actions";
import { Fld, Form } from "./property-view";

type Fn = Database["public"]["Functions"];
type Lot = Fn["my_properties"]["Returns"][number];
type Work = Fn["my_property_work"]["Returns"][number];
type Detail = Fn["my_property_work_detail"]["Returns"][number];
type Budget = Fn["my_property_budgets"]["Returns"][number];
type Stay = Fn["my_property_hospitality"]["Returns"][number];
type Invoice = Fn["my_property_invoices"]["Returns"][number];
type Note = Fn["my_property_notes"]["Returns"][number];

type Material = { name: string; quantity: number; unit: string | null; source: string };
type Photo = { kind: string; path: string };

const muted = { color: "var(--pv-muted)" } as const;
export const crc = (n: number) => `₡${Math.round(n).toLocaleString("en-US")}`;
const day = (d: string) => fmtDate(d, { month: "short", day: "numeric", year: "numeric" });
const ts = (d: string) => fmtDate(d.slice(0, 10), { month: "short", day: "numeric", year: "numeric" });

const STATUS: Record<string, string> = { open: "Open", in_progress: "In progress", done: "Done" };

/** Tasks joined with their hours, materials, photos and charge. */
export function joinWork(logs: Work[], detail: Detail[]) {
  const by = new Map(detail.map((d) => [d.task_id, d]));
  return logs.map((l) => ({ ...l, d: by.get(l.id) }));
}

export function MaintenanceTab({
  lot,
  logs,
  detail,
  photoUrls,
}: {
  lot: Lot;
  logs: Work[];
  detail: Detail[];
  photoUrls: Record<string, string>;
}) {
  const rows = joinWork(logs, detail);
  return (
    <div className="pv-two">
      <section className="pv-panel">
        <h2>Maintenance log</h2>
        {rows.length === 0 ? (
          <p style={{ ...muted, marginTop: 0 }}>
            Nothing logged yet. Repairs, garden, pool and cleaning work the team does will show here.
          </p>
        ) : (
          rows.map((l) => {
            const photos = (l.d?.photos as Photo[] | undefined) ?? [];
            const materials = (l.d?.materials as Material[] | undefined) ?? [];
            const hours = Number(l.d?.hours ?? 0);
            const charge = Number(l.d?.charge ?? 0);
            return (
              <div key={l.id} className="pv-post">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <b>{l.title}</b>
                  <span style={{ ...muted, fontSize: 13.5, whiteSpace: "nowrap" }}>
                    {l.status === "done" ? day(l.on_date) : STATUS[l.status]}
                  </span>
                </div>
                <div style={{ ...muted, fontSize: 13.5 }}>
                  {label(MAINT_CATEGORIES, l.category)}
                  {l.done_by ? ` · ${l.done_by}` : ""}
                  {hours > 0 ? ` · ${hours} h` : ""}
                  {charge > 0 ? ` · ${crc(charge)}` : ""}
                </div>
                {l.details && <div style={{ fontSize: 14.5, marginTop: 4 }}>{l.details}</div>}
                {materials.length > 0 && (
                  <div style={{ fontSize: 14, marginTop: 6 }}>
                    <span style={muted}>Materials: </span>
                    {materials
                      .map((m) => `${m.name}${Number(m.quantity) !== 1 || m.unit ? ` (${Number(m.quantity)}${m.unit ? ` ${m.unit}` : ""})` : ""}`)
                      .join(", ")}
                  </div>
                )}
                {photos.length > 0 && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                    {photos.map((p) =>
                      photoUrls[p.path] ? (
                        <a key={p.path} href={photoUrls[p.path]} target="_blank" rel="noreferrer" title={p.kind === "before" ? "Before" : "After"}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photoUrls[p.path]}
                            alt={`${p.kind === "before" ? "Before" : "After"}: ${l.title}`}
                            style={{ width: 96, height: 72, objectFit: "cover", borderRadius: 10 }}
                          />
                        </a>
                      ) : null,
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>
      <aside>
        <section className="pv-panel">
          <h2>Ask the team for work</h2>
          <Form action={requestWork} submit="Send request" reset>
            <input type="hidden" name="lot_id" value={lot.id} />
            <Fld id="rq-title" text="What do you need?">
              <input id="rq-title" name="title" className="pv-input" required placeholder="e.g. Pool pump is making noise" />
            </Fld>
            <Fld id="rq-cat" text="Type">
              <select id="rq-cat" name="category" className="pv-input" defaultValue="repair">
                {MAINT_CATEGORIES.filter(([k]) => k !== "build").map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </Fld>
            <Fld id="rq-det" text="Details">
              <textarea id="rq-det" name="details" className="pv-input" rows={3} />
            </Fld>
          </Form>
          <p style={{ ...muted, fontSize: 13.5, marginBottom: 0 }}>
            Hours are charged at the team’s bill rate; materials at what they cost. Both show here once the work is done.
          </p>
        </section>
      </aside>
    </div>
  );
}

export function BudgetsTab({ budgets }: { budgets: Budget[] }) {
  const toast = useToast();
  const [busy, start] = useTransition();
  const [comment, setComment] = useState<Record<string, string>>({});
  const pending = budgets.filter((b) => b.status === "pending");
  const history = budgets.filter((b) => b.status !== "pending");
  const decide = (id: string, approve: boolean) => {
    if (!approve && !window.confirm("Decline this budget?")) return;
    start(async () => {
      const r = await decideBudget(id, approve, comment[id] ?? null);
      toast(r.ok ? (r.message ?? "Saved") : (r.error ?? "Couldn’t save"));
    });
  };
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section className="pv-panel">
        <h2>Waiting for your approval</h2>
        {pending.length === 0 ? (
          <p style={{ ...muted, margin: 0 }}>Nothing is waiting. When the team needs a budget for your property, it shows up here.</p>
        ) : (
          pending.map((b) => (
            <div key={b.id} className="pv-post">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <b>{b.title}</b>
                <b style={{ whiteSpace: "nowrap" }}>{crc(Number(b.amount))}</b>
              </div>
              <div style={{ ...muted, fontSize: 13.5 }}>
                Asked {ts(b.requested_at)}
                {b.requested_by_name ? ` by ${b.requested_by_name}` : ""}
                {b.task_title ? ` · for “${b.task_title}”` : ""}
              </div>
              {b.details && <div style={{ fontSize: 14.5, marginTop: 4, whiteSpace: "pre-line" }}>{b.details}</div>}
              <input
                className="pv-input"
                style={{ marginTop: 10 }}
                placeholder="Add a comment (optional)"
                aria-label="Comment"
                value={comment[b.id] ?? ""}
                onChange={(e) => setComment({ ...comment, [b.id]: e.target.value })}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button type="button" className="pv-btn sm" disabled={busy} onClick={() => decide(b.id, true)}>
                  Approve
                </button>
                <button type="button" className="pv-btn ghost sm" disabled={busy} onClick={() => decide(b.id, false)}>
                  Decline
                </button>
              </div>
            </div>
          ))
        )}
      </section>
      <section className="pv-panel">
        <h2>History</h2>
        {history.length === 0 ? (
          <p style={{ ...muted, margin: 0 }}>Budgets you have approved or declined will be listed here.</p>
        ) : (
          history.map((b) => (
            <div key={b.id} className="pv-post">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <b>{b.title}</b>
                <span style={{ whiteSpace: "nowrap" }}>{crc(Number(b.amount))}</span>
              </div>
              <div style={{ ...muted, fontSize: 13.5 }}>
                {b.status === "approved" ? "Approved" : "Declined"}
                {b.decided_at ? ` ${ts(b.decided_at)}` : ""}
                {b.task_title ? ` · ${b.task_title}` : ""}
              </div>
              {b.decision_comment && <div style={{ fontSize: 14.5, marginTop: 4 }}>“{b.decision_comment}”</div>}
            </div>
          ))
        )}
      </section>
    </div>
  );
}

const PHASE: Record<string, string> = {
  upcoming: "Upcoming",
  in_house: "In the house",
  checked_out: "Checked out",
  cancelled: "Cancelled",
};

export function HospitalityTab({ lot, stays }: { lot: Lot; stays: Stay[] }) {
  const current = stays.filter((s) => s.phase === "in_house" || s.phase === "upcoming").reverse();
  const past = stays.filter((s) => s.phase === "checked_out" || s.phase === "cancelled");
  const passCount = stays.filter((s) => s.phase !== "cancelled").reduce((a, s) => a + ((s.passes as unknown[]) ?? []).length, 0);
  const list = (items: Stay[]) =>
    items.map((s) => {
      const passes = (s.passes as { tier: string; from: string | null; until: string | null }[]) ?? [];
      return (
        <div key={s.id} className="pv-post">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <b>{s.guest_name}</b>
            <span style={{ ...muted, fontSize: 13.5, whiteSpace: "nowrap" }}>{PHASE[s.phase]}</span>
          </div>
          <div style={{ ...muted, fontSize: 13.5 }}>
            Check-in {day(s.check_in)} · check-out {day(s.check_out)}
            {s.guests ? ` · ${s.guests} guest${s.guests === 1 ? "" : "s"}` : ""}
            {s.status === "inquiry" ? " · not confirmed" : ""}
          </div>
          <div style={{ fontSize: 14, marginTop: 4 }}>
            {passes.length === 0 ? (
              <span style={muted}>No passes issued</span>
            ) : (
              <>
                <span style={muted}>Passes: </span>
                {passes.map((p) => p.tier).join(", ")}
              </>
            )}
          </div>
        </div>
      );
    });
  if (!lot.in_hospitality)
    return (
      <section className="pv-panel">
        <h2>Hospitality</h2>
        <p style={{ ...muted, margin: 0 }}>
          Hospitality is off. Turn it on from the <Link href={`/steward?tab=schedule&lot=${lot.id}`}>Schedule</Link> tab to
          offer your home to guests when you’re away.
        </p>
      </section>
    );
  return (
    <div className="pv-two">
      <div style={{ display: "grid", gap: 20 }}>
        <section className="pv-panel">
          <h2>Current and upcoming stays</h2>
          {current.length === 0 ? <p style={{ ...muted, margin: 0 }}>No guests booked right now.</p> : list(current)}
        </section>
        <section className="pv-panel">
          <h2>Past stays</h2>
          {past.length === 0 ? <p style={{ ...muted, margin: 0 }}>Nothing in the last year.</p> : list(past)}
        </section>
      </div>
      <aside style={{ display: "grid", gap: 20 }}>
        <section className="pv-panel">
          <h2>In the programme</h2>
          <p style={{ marginTop: 0 }}>
            {lot.hospitality_since ? `Since ${fmtDate(lot.hospitality_since, { month: "long", year: "numeric" })}. ` : ""}
            {lot.listing_published ? "Your home is listed for guests." : "Your home isn’t listed for guests yet."}
          </p>
          <p style={{ ...muted, fontSize: 14, margin: "0 0 10px" }}>
            {[
              lot.nightly_rate !== null ? `${money(lot.nightly_rate, lot.rate_currency)} a night` : null,
              lot.max_guests ? `up to ${lot.max_guests} guests` : null,
              lot.min_nights > 1 ? `${lot.min_nights}-night minimum` : null,
              `${passCount} pass${passCount === 1 ? "" : "es"} issued to guests`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p style={{ margin: 0 }}>
            <Link href={`/steward?tab=schedule&lot=${lot.id}`}>Manage availability →</Link>
          </p>
        </section>
        <section className="pv-panel">
          <h2>Notes for the hospitality team</h2>
          <Form action={saveMyNotes} submit="Save notes">
            <input type="hidden" name="lot_id" value={lot.id} />
            <textarea
              name="notes"
              className="pv-input"
              rows={4}
              defaultValue={lot.listing_notes ?? ""}
              aria-label="Notes for the hospitality team"
              placeholder="House rules, check-in instructions, what you want kept private"
            />
          </Form>
        </section>
      </aside>
    </div>
  );
}

export function BillingTab({ logs, detail, invoices }: { logs: Work[]; detail: Detail[]; invoices: Invoice[] }) {
  const billed = joinWork(logs, detail)
    .filter((l) => l.status === "done" && Number(l.d?.charge ?? 0) > 0)
    .sort((a, b) => a.on_date.localeCompare(b.on_date));
  const lines = billed.map((l, i) => ({
    l,
    total: billed.slice(0, i + 1).reduce((a, x) => a + Number(x.d?.charge ?? 0), 0),
  }));
  const run = lines.at(-1)?.total ?? 0;
  const labour = billed.reduce((a, l) => a + Number(l.d?.labour ?? 0), 0);
  const materials = billed.reduce((a, l) => a + Number(l.d?.materials_cost ?? 0), 0);
  const invoiced = invoices.reduce((a, i) => a + Number(i.amount), 0);
  const open = invoices.filter((i) => i.status === "unpaid").reduce((a, i) => a + Number(i.amount), 0);
  const stat = (t: string, v: string) => (
    <div className="pv-panel" style={{ padding: 16 }}>
      <div style={{ ...muted, fontSize: 13.5 }}>{t}</div>
      <div style={{ fontSize: 24, fontWeight: 600 }}>{v}</div>
    </div>
  );
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
        {stat("Charged for work", crc(run))}
        {stat("Labour", crc(labour))}
        {stat("Materials", crc(materials))}
        {stat("Invoiced, still open", crc(open))}
      </div>
      <section className="pv-panel">
        <h2>Labour and materials</h2>
        {lines.length === 0 ? (
          <p style={{ ...muted, margin: 0 }}>No finished work has been charged to your property yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14.5 }}>
              <thead>
                <tr style={{ textAlign: "left", ...muted }}>
                  <th style={{ padding: "6px 8px 6px 0" }}>Date</th>
                  <th>Work</th>
                  <th style={{ textAlign: "right" }}>Labour</th>
                  <th style={{ textAlign: "right" }}>Materials</th>
                  <th style={{ textAlign: "right" }}>Charge</th>
                  <th style={{ textAlign: "right", paddingLeft: 8 }}>Running total</th>
                </tr>
              </thead>
              <tbody>
                {lines.map(({ l, total }) => (
                  <tr key={l.id} style={{ borderTop: "1px solid var(--pv-line)" }}>
                    <td style={{ padding: "8px 8px 8px 0", whiteSpace: "nowrap" }}>{day(l.on_date)}</td>
                    <td>{l.title}</td>
                    <td style={{ textAlign: "right" }}>{crc(Number(l.d?.labour ?? 0))}</td>
                    <td style={{ textAlign: "right" }}>{crc(Number(l.d?.materials_cost ?? 0))}</td>
                    <td style={{ textAlign: "right" }}>{crc(Number(l.d?.charge ?? 0))}</td>
                    <td style={{ textAlign: "right", paddingLeft: 8, fontWeight: 600 }}>{crc(total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p style={{ ...muted, fontSize: 13.5, marginBottom: 0 }}>All amounts in colones. Work the team logs before hours were tracked shows its flat cost.</p>
      </section>
      <section className="pv-panel">
        <h2>Invoices</h2>
        {invoices.length === 0 ? (
          <p style={{ ...muted, margin: 0 }}>No invoices yet.</p>
        ) : (
          <>
            {invoices.map((i) => (
              <div key={i.id} className="pv-post">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <b>{i.description || i.category || "Invoice"}</b>
                  <span style={{ whiteSpace: "nowrap" }}>{crc(Number(i.amount))}</span>
                </div>
                <div style={{ ...muted, fontSize: 13.5 }}>
                  {i.status === "paid" ? `Paid ${i.paid_on ? day(i.paid_on) : ""}` : `Sent ${day(i.entry_date)}${i.due_date ? ` · due ${day(i.due_date)}` : ""}`}
                </div>
              </div>
            ))}
            <p style={{ ...muted, fontSize: 13.5, marginBottom: 0 }}>Invoiced in total: {crc(invoiced)}</p>
          </>
        )}
      </section>
    </div>
  );
}

export function NotesTab({ lot, notes }: { lot: Lot; notes: Note[] }) {
  const toast = useToast();
  const [busy, start] = useTransition();
  return (
    <div className="pv-two">
      <section className="pv-panel">
        <h2>Shared notes</h2>
        {notes.length === 0 ? (
          <p style={{ ...muted, margin: 0 }}>No notes yet. Use this to leave something for the community managers, and they can reply here.</p>
        ) : (
          notes.map((n) => (
            <div key={n.id} className="pv-post">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <b>
                  {n.mine ? "You" : n.author_name}
                  <span style={{ ...muted, fontWeight: 400 }}> · {n.author_kind === "team" ? "The ARK team" : "Steward"}</span>
                </b>
                <span style={{ ...muted, fontSize: 13.5, whiteSpace: "nowrap" }}>{ts(n.created_at)}</span>
              </div>
              <div style={{ whiteSpace: "pre-line", fontSize: 15, marginTop: 4 }}>{n.body}</div>
              {n.mine && (
                <button
                  type="button"
                  className="pv-btn ghost sm"
                  style={{ marginTop: 8 }}
                  disabled={busy}
                  onClick={() =>
                    start(async () => {
                      const r = await deletePropertyNote(n.id);
                      toast(r.ok ? (r.message ?? "Removed") : (r.error ?? "Couldn’t remove"));
                    })
                  }
                >
                  Remove
                </button>
              )}
            </div>
          ))
        )}
      </section>
      <aside>
        <section className="pv-panel">
          <h2>Add a note</h2>
          <Form action={addPropertyNote} submit="Post note" reset>
            <input type="hidden" name="lot_id" value={lot.id} />
            <textarea name="body" className="pv-input" rows={4} required aria-label="Note" placeholder="Write to the community managers" />
          </Form>
        </section>
      </aside>
    </div>
  );
}
