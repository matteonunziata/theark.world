"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Columns } from "@/components/charts";
import { Drawer, useDrawer } from "@/components/drawer";
import { useToast } from "@/components/toast";
import type { ActionResult } from "@/lib/action-result";
import { fmtDate } from "@/lib/dates";
import { money } from "@/lib/schedule";
import { emailTicket, removeBooking, setPaid } from "../../actions";
import { LiveRefresh } from "./live";
import { saveRegistration, setCancelled } from "./actions";

export type Row = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  sessionDate: string;
  registeredAt: string;
  status: "active" | "pending" | "cancelled";
  paid: boolean;
  source: string;
  checkedIn: boolean;
  token: string;
  seats: number;
  items: { ticketId: string | null; name: string; qty: number }[];
  total: string;
};

type Ticket = { id: string; name: string; kind: string; price: number; currency: string; qty: number | null };
type Stats = {
  registrations: number;
  pending: number;
  cancelled: number;
  ticketsSold: number;
  revenue: string;
  owed: string;
  refund: string;
  hasOwed: boolean;
  hasRefund: boolean;
  byType: { id: string; name: string; kind: string; capacity: number | null; sold: number; revenue: string }[];
  daily: { day: string; bookings: number; tickets: number }[];
};

const FILTERS = [
  ["all", "All"],
  ["active", "Active"],
  ["pending", "Pending payment"],
  ["unpaid", "Unpaid"],
  ["cancelled", "Cancelled"],
] as const;

const statusLabel = (r: Row) =>
  r.status === "cancelled" ? "Cancelled" : r.status === "pending" ? "Pending payment" : r.paid ? "Paid" : "Unpaid";

export function RegistrationsView({
  offering,
  tickets,
  rows,
  dates,
  date,
  canManage,
  stats,
}: {
  offering: { id: string; title: string; capacity: number | null; slug: string | null; kind: string };
  tickets: Ticket[];
  rows: Row[];
  dates: string[];
  date: string;
  canManage: boolean;
  stats: Stats;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const drawer = useDrawer<Row>();
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("all");
  const [q, setQ] = useState("");

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "active" && r.status !== "active") return false;
      if (filter === "pending" && r.status !== "pending") return false;
      if (filter === "cancelled" && r.status !== "cancelled") return false;
      if (filter === "unpaid" && !(r.status === "active" && !r.paid)) return false;
      return !needle || r.name.toLowerCase().includes(needle) || (r.email ?? "").toLowerCase().includes(needle) || (r.phone ?? "").includes(needle);
    });
  }, [rows, filter, q]);

  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      const r = await fn();
      toast(r.ok ? (r.message ?? "Done") : (r.error ?? "Couldn’t do that"));
      if (r.ok) router.refresh();
    });

  const cancel = (r: Row) => {
    const refundNote = r.paid
      ? "\n\nThis booking was paid. Cancelling doesn’t refund it: refund it in Stripe, and the refund will show here."
      : "";
    if (window.confirm(`Cancel ${r.name}’s booking? Their spots and tickets are freed.${refundNote}`)) {
      run(() => setCancelled(r.id, true));
    }
  };

  const spots = offering.capacity ? `${stats.ticketsSold} of ${offering.capacity}` : String(stats.ticketsSold);

  return (
    <>
      <div className="page-head" style={{ marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>{offering.title}</h2>
          <p className="lede" style={{ margin: "4px 0 0" }}>
            Registrations and sales, updated as people book. <LiveRefresh offeringId={offering.id} />
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="btn" href={`/e/${offering.slug ?? offering.id}`} target="_blank">
            Open event page
          </Link>
          {canManage && (
            <button type="button" className="btn primary" onClick={drawer.openNew}>
              Add attendee
            </button>
          )}
        </div>
      </div>

      {dates.length > 1 && (
        <div className="toolbar" style={{ marginBottom: 12 }}>
          <label className="muted" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            Date
            <select value={date} onChange={(e) => router.replace(e.target.value ? `?d=${e.target.value}` : "?")}>
              <option value="">All dates</option>
              {dates.map((d) => (
                <option key={d} value={d}>
                  {fmtDate(d, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="kpis" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
        <div className="kpi">
          <span>Registrations</span>
          <b>{stats.registrations}</b>
          <small>
            {stats.pending ? `${stats.pending} pending payment` : "Confirmed bookings"}
            {stats.cancelled ? ` · ${stats.cancelled} cancelled` : ""}
          </small>
        </div>
        <div className="kpi">
          <span>Tickets sold</span>
          <b>{spots}</b>
          <small>{offering.capacity ? "Against the capacity per date" : "All ticket types"}</small>
        </div>
        <div className="kpi">
          <span>Revenue</span>
          <b>{stats.revenue}</b>
          <small>
            Paid{stats.hasOwed ? ` · ${stats.owed} still to collect` : ""}
            {stats.hasRefund ? ` · ${stats.refund} to refund` : ""}
          </small>
        </div>
      </div>

      <div className="grid2" style={{ alignItems: "start", marginBottom: 22 }}>
        <section className="panel">
          <h3 style={{ margin: "0 0 10px" }}>Tickets by type</h3>
          {stats.byType.length ? (
            <div className="list">
              <div className="row head" style={{ gridTemplateColumns: "1.4fr 0.8fr 1fr" }}>
                <span>Ticket</span>
                <span>Sold</span>
                <span>Revenue</span>
              </div>
              {stats.byType.map((t) => (
                <div className="row" key={t.id} style={{ gridTemplateColumns: "1.4fr 0.8fr 1fr" }}>
                  <span>
                    <b>{t.name}</b>
                    {t.kind === "addon" && <span className="muted"> · add-on</span>}
                  </span>
                  <span>
                    {t.sold}
                    {t.capacity ? ` / ${t.capacity}` : ""}
                  </span>
                  <span>{t.revenue}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted" style={{ margin: 0 }}>This event has no ticket types.</p>
          )}
        </section>
        <section className="panel">
          <h3 style={{ margin: "0 0 10px" }}>Bookings per day</h3>
          {stats.daily.length ? (
            <Columns
              label="Bookings per day"
              rows={stats.daily.map((x) => ({
                label: fmtDate(x.day, { month: "short", day: "numeric" }),
                value: x.bookings,
                note: `${x.tickets} ${x.tickets === 1 ? "ticket" : "tickets"}`,
              }))}
            />
          ) : (
            <p className="muted" style={{ margin: 0 }}>No bookings yet.</p>
          )}
        </section>
      </div>

      <div className="toolbar" style={{ marginBottom: 8 }}>
        <div className="pills" role="group" aria-label="Filter registrations" style={{ flex: 1, margin: 0 }}>
          {FILTERS.map(([v, label]) => (
            <button key={v} type="button" className="pill" aria-pressed={filter === v} onClick={() => setFilter(v)}>
              {label}
            </button>
          ))}
        </div>
        <input type="search" placeholder="Search name, email or phone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search registrations" />
      </div>

      {shown.length === 0 ? (
        <div className="empty">
          <p>{rows.length ? "No bookings match." : "No bookings yet."}</p>
        </div>
      ) : (
        <div className="list" style={{ overflowX: "auto" }}>
          <div className="row head" style={{ gridTemplateColumns: "1.5fr 1.2fr 1fr 1fr 1.2fr", minWidth: 760 }}>
            <span>Registrant</span>
            <span>Tickets</span>
            <span>Status</span>
            <span>Registered</span>
            <span>Actions</span>
          </div>
          {shown.map((r) => (
            <div className="row" key={r.id} style={{ gridTemplateColumns: "1.5fr 1.2fr 1fr 1fr 1.2fr", minWidth: 760, alignItems: "center", opacity: r.status === "cancelled" ? 0.65 : 1 }}>
              <span>
                <b>{r.name}</b>
                <span className="muted" style={{ display: "block", fontSize: 13 }}>
                  {[r.email, r.phone].filter(Boolean).join(" · ") || "No contact details"}
                </span>
              </span>
              <span>
                {r.items.length ? r.items.map((i) => `${i.qty} × ${i.name}`).join(", ") : `${r.seats} ${r.seats === 1 ? "spot" : "spots"}, no ticket`}
                {r.total && <span className="muted" style={{ display: "block", fontSize: 13 }}>{r.total}</span>}
                {dates.length > 1 && !date && (
                  <span className="muted" style={{ display: "block", fontSize: 13 }}>
                    {fmtDate(r.sessionDate, { weekday: "short", month: "short", day: "numeric" })}
                  </span>
                )}
              </span>
              <span>
                <span className={`status ${r.status === "active" && r.paid ? "on" : "off"}`}>{statusLabel(r)}</span>
                {r.checkedIn && <span className="muted" style={{ display: "block", fontSize: 13 }}>Checked in</span>}
              </span>
              <span className="muted">{r.registeredAt}</span>
              <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button type="button" className="btn sm" onClick={() => drawer.openItem(r)}>
                  {canManage ? "Details" : "View"}
                </button>
                {canManage && (
                  <>
                    {r.status === "cancelled" ? (
                      <button type="button" className="btn sm" disabled={pending} onClick={() => run(() => setCancelled(r.id, false))}>
                        Restore
                      </button>
                    ) : (
                      <button type="button" className="btn sm" disabled={pending} onClick={() => cancel(r)}>
                        Cancel
                      </button>
                    )}
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      <RegistrationDrawer
        key={drawer.item?.id ?? "new"}
        open={drawer.open}
        row={drawer.item}
        offering={offering}
        tickets={tickets}
        dates={dates}
        canManage={canManage}
        pending={pending}
        onClose={drawer.close}
        onRun={run}
        onCancel={cancel}
      />
    </>
  );
}

function RegistrationDrawer({
  open,
  row,
  offering,
  tickets,
  dates,
  canManage,
  pending,
  onClose,
  onRun,
  onCancel,
}: {
  open: boolean;
  row: Row | null;
  offering: { id: string; title: string; capacity: number | null };
  tickets: Ticket[];
  dates: string[];
  canManage: boolean;
  pending: boolean;
  onClose: () => void;
  onRun: (fn: () => Promise<ActionResult>) => void;
  onCancel: (r: Row) => void;
}) {
  const held = (id: string) => row?.items.find((i) => i.ticketId === id)?.qty ?? 0;
  const today = new Date().toISOString().slice(0, 10);
  const first = dates.find((d) => d >= today) ?? dates[dates.length - 1] ?? today;

  return (
    <Drawer
      title={row ? "Booking" : "Add attendee"}
      open={open}
      onClose={onClose}
      action={canManage ? saveRegistration : undefined}
      footer={
        canManage ? (
          <>
            {row && (
              <>
                <button
                  type="button"
                  className="btn danger"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm(`Remove ${row.name} completely? This deletes the booking. To keep a record, cancel it instead.`)) {
                      onRun(() => removeBooking(row.id));
                      onClose();
                    }
                  }}
                >
                  Remove
                </button>
                {row.status !== "cancelled" && (
                  <button type="button" className="btn" disabled={pending} onClick={() => {
                      onCancel(row);
                      onClose();
                    }}
                  >
                    Cancel booking
                  </button>
                )}
              </>
            )}
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={onClose}>
              Close
            </button>
            <button type="submit" className="btn primary">
              {row ? "Save changes" : "Add attendee"}
            </button>
          </>
        ) : (
          <>
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={onClose}>
              Close
            </button>
          </>
        )
      }
    >
      <fieldset disabled={!canManage} style={{ border: 0, padding: 0, margin: 0 }}>
        <input type="hidden" name="offering_id" value={offering.id} />
        {row && <input type="hidden" name="registration_id" value={row.id} />}

        {row && (
          <dl className="kv" style={{ marginBottom: 16 }}>
            <dt>Status</dt>
            <dd>{statusLabel(row)}{row.checkedIn ? ", checked in" : ""}</dd>
            <dt>Registered</dt>
            <dd>{row.registeredAt}, {row.source === "staff" ? "added by staff" : row.source === "portal" ? "members portal" : "event page"}</dd>
            <dt>Total</dt>
            <dd>{row.total || "No charge"}</dd>
            <dt>Ticket</dt>
            <dd><Link href={`/t/${row.token}`} target="_blank">Open the ticket</Link></dd>
          </dl>
        )}

        <div className="fld">
          <label htmlFor="r-name">Name</label>
          <input id="r-name" name="name" defaultValue={row?.name} required />
        </div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="r-email">Email</label>
            <input id="r-email" name="email" type="email" defaultValue={row?.email ?? ""} />
          </div>
          <div className="fld">
            <label htmlFor="r-phone">Phone (WhatsApp)</label>
            <input id="r-phone" name="phone" type="tel" defaultValue={row?.phone ?? ""} />
          </div>
        </div>
        <div className="fld">
          <label htmlFor="r-date">Date</label>
          <input id="r-date" name="session_date" type="date" defaultValue={row?.sessionDate ?? first} required />
        </div>

        <div className="subhead">Tickets</div>
        {tickets.length ? (
          tickets.map((t) => (
            <div className="trow" key={t.id} style={{ gridTemplateColumns: "1fr 90px", alignItems: "center" }}>
              <span>
                <b>{t.name}</b>
                <span className="muted" style={{ display: "block", fontSize: 13 }}>
                  {money(t.price, t.currency)}
                  {t.kind === "addon" ? ", optional add-on" : ""}
                </span>
              </span>
              <input name={`qty_${t.id}`} type="number" min={0} max={50} defaultValue={held(t.id)} aria-label={`${t.name} quantity`} />
            </div>
          ))
        ) : (
          <p className="muted">This event has no ticket types, so the booking takes one spot.</p>
        )}
        {tickets.length > 0 && <span className="hint">Leave all at 0 for a guest with no ticket (one spot).</span>}

        <div className="subhead">Payment</div>
        {row ? (
          <label className="hint" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" name="paid" defaultChecked={row.paid} />
            Paid
            {!row.paid && row.email && (
              <button type="button" className="mini" style={{ marginLeft: "auto" }} onClick={() => onRun(() => setPaid(row.id, true))} disabled={pending}>
                Mark paid now
              </button>
            )}
          </label>
        ) : (
          <label className="hint" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" name="paid" />
            Already paid (cash, transfer or comp)
          </label>
        )}
        {!row && (
          <label className="hint" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
            <input type="checkbox" name="send" defaultChecked />
            Email them their ticket (needs an email)
          </label>
        )}
        {row?.email && row.status !== "cancelled" && (
          <p style={{ margin: "10px 0 0" }}>
            <button type="button" className="btn sm" disabled={pending} onClick={() => onRun(() => emailTicket(row.id))}>
              Email the ticket again
            </button>
          </p>
        )}
        {offering.capacity && (
          <label className="hint" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
            <input type="checkbox" name="override" />
            Allow this even if it goes past the capacity or a ticket’s stock
          </label>
        )}
      </fieldset>
    </Drawer>
  );
}
