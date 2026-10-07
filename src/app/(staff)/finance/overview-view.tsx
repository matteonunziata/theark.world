"use client";

import Link from "next/link";
import { useState } from "react";
import { ConfirmButton, Drawer, useDrawer } from "@/components/drawer";
import { addMonths, fmtDate, monthLabel, shortMonth } from "@/lib/dates";
import { type Conv, convert, type Entry, fmtSum, type Line, rateNote, sumIn } from "@/lib/finance";
import { COLORS, colorVar } from "@/lib/roles";
import { fmtMoney } from "@/lib/shop";
import { buildSnapshot } from "@/lib/finance-snapshot";
import type { SectorRollup } from "./budgets/rollup";
import { saveCash, saveLine } from "./actions";
import { type Attention, SnapshotView } from "./snapshot-view";
import { type DrawerTarget, EntryDrawer } from "./entry-drawer";

type Cash = { key: string; cash: number | null; cash_date: string | null; notes: string | null };

export function OverviewView({
  month: k,
  prev,
  next,
  thisMonth,
  entries,
  lines,
  cash,
  ticketSales,
  sectors,
  attention,
  currency,
  conv,
  today,
}: {
  month: string;
  prev: string;
  next: string;
  thisMonth: string;
  entries: Entry[];
  lines: Line[];
  cash: Cash[];
  ticketSales: number;
  sectors: SectorRollup[];
  attention: Attention;
  /** The organization\u2019s own currency: cash in bank and ticket sales are kept in it. */
  currency: string;
  conv: Conv;
  today: string;
}) {
  const [target, setTarget] = useState<DrawerTarget | null>(null);
  const cashDrawer = useDrawer<string>();
  const lineDrawer = useDrawer<Line>();
  const money = (n: number | null | undefined) => fmtMoney(n, conv.to);
  const main = (es: Entry[]) => sumIn(es, conv).value;
  const mark = currency === conv.to ? "" : "~";
  // Budgets are planned and tracked in colones.
  const budgetMoney = (crc: number) => (conv.to === "CRC" ? "" : "~") + fmtMoney(convert(crc, "CRC", conv), conv.to);
  const tickets = convert(ticketSales, currency, conv);

  const monthEntries = entries.filter((e) => e.entry_date.startsWith(k));
  const inc = monthEntries.filter((e) => e.kind === "income");
  const exp = monthEntries.filter((e) => e.kind === "expense");
  const net = main(inc) - main(exp);
  const open = entries.filter((e) => e.status === "unpaid");
  const ar = open.filter((e) => e.kind === "income");
  const ap = open.filter((e) => e.kind === "expense");
  const c = cash.find((x) => x.key === k);

  const shown = [
    ...lines.filter((l) => l.active || monthEntries.some((e) => e.business_line_id === l.id)),
    ...(monthEntries.some((e) => !e.business_line_id)
      ? [{ id: "", name: "Not assigned", color: "slate" } as Line]
      : []),
  ];
  const ofLine = (es: Entry[], id: string) => es.filter((e) => (e.business_line_id ?? "") === id);

  // Latest cash figure on or before the month being viewed, shown in the viewing currency.
  const lastCash = [...cash].filter((x) => x.cash != null && x.key <= k).sort((a, b) => b.key.localeCompare(a.key))[0];
  const cashNow = lastCash?.cash != null ? convert(Number(lastCash.cash), currency, conv) : null;
  const snap = buildSnapshot({
    entries,
    month: k,
    today,
    conv,
    cash: cashNow,
    lineName: (id) => lines.find((l) => l.id === id)?.name ?? "Not assigned",
  });

  const six = Array.from({ length: 6 }, (_, i) => addMonths(k, i - 5));
  const series = six.map((m) => {
    const es = entries.filter((e) => e.entry_date.startsWith(m));
    return {
      m,
      rev: main(es.filter((e) => e.kind === "income")),
      exp: main(es.filter((e) => e.kind === "expense")),
    };
  });
  const max = Math.max(1, ...series.flatMap((s) => [s.rev, s.exp]));
  const W = 520;
  const H = 180;
  const pad = 24;
  const bw = (W - pad * 2) / 6;

  const kpi = (label: string, val: string, cls = "", small = "") => (
    <div className={`kpi ${cls}`}>
      <span>{label}</span>
      <b>{val}</b>
      {small && <small>{small}</small>}
    </div>
  );

  return (
    <>
      <div className="monthnav">
        <span className="range">{monthLabel(k)}</span>
        <Link className="btn" href={`/finance?m=${prev}`}>Previous</Link>
        <Link className="btn" href={`/finance?m=${thisMonth}`}>This month</Link>
        <Link className="btn" href={`/finance?m=${next}`}>Next</Link>
        <button type="button" className="btn" onClick={() => setTarget({ kind: "expense" })}>Add expense</button>
        <button type="button" className="btn primary" onClick={() => setTarget({ kind: "income" })}>Add income</button>
      </div>
      {!monthEntries.length && (
        <div className="banner">
          Nothing recorded for {monthLabel(k)} yet. Add income and expenses as they happen, and the
          totals by business line fill in here.
        </div>
      )}
      <div className="kpis">
        {kpi("Revenue", fmtSum(inc, conv), "", ticketSales ? `Plus ${mark}${money(tickets)} in event tickets marked paid` : "")}
        {kpi("Expenses", fmtSum(exp, conv))}
        {kpi("Net", money(net), net < 0 ? "neg" : net > 0 ? "pos" : "", monthEntries.some((e) => e.currency !== conv.to) || mark ? rateNote(conv) : "")}
        {kpi("Cash in bank", c?.cash != null ? mark + money(convert(c.cash, currency, conv)) : "—", "", c?.cash_date ? `as of ${fmtDate(c.cash_date)}` : "")}
        {kpi("Receivable", fmtSum(ar, conv), "", `${ar.length} open invoice${ar.length === 1 ? "" : "s"}`)}
        {kpi("Payable", fmtSum(ap, conv), "", `${ap.length} open bill${ap.length === 1 ? "" : "s"}`)}
      </div>
      <SnapshotView
        snap={snap}
        attention={attention}
        sectors={sectors}
        conv={conv}
        monthName={monthLabel(k)}
        prevName={shortMonth(addMonths(k, -1))}
        cash={{ value: cashNow, date: lastCash?.cash_date ? fmtDate(lastCash.cash_date) : null }}
        lineColor={(id) => colorVar(lines.find((l) => l.id === id)?.color)}
        isLatest={k === thisMonth}
      />
      <div className="fin-grid">
        <div className="brk">
          <h2>Revenue by business line</h2>
          {shown.map((l) => {
            const r = ofLine(inc, l.id);
            const x = ofLine(exp, l.id);
            return (
              <div key={l.id || "none"}>
                <div className="ln">
                  <span className="dot-label"><i style={{ background: colorVar(l.color) }} />{l.name}</span>
                  <span>{fmtSum(r, conv)}</span>
                </div>
                {x.length > 0 && (
                  <div className="ln sub" style={{ borderTop: 0, paddingTop: 0 }}>
                    <span style={{ paddingLeft: 16 }}>expenses</span>
                    <span>−{fmtSum(x, conv)}</span>
                  </div>
                )}
              </div>
            );
          })}
          {ticketSales > 0 && (
            <div className="ln sub">
              <span>Event tickets marked paid (from bookings)</span>
              <span>{mark}{money(tickets)}</span>
            </div>
          )}
          <div className="ln">
            <span><b>Total revenue</b></span>
            <span><b>{fmtSum(inc, conv)}</b></span>
          </div>
          <p style={{ margin: "12px 0 0", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn ghost sm" onClick={lineDrawer.openNew}>Add a business line</button>
            <button type="button" className="btn ghost sm" onClick={() => cashDrawer.openItem(k)}>
              {c ? "Update cash in bank" : "Record cash in bank"}
            </button>
          </p>
        </div>
        <div className="chart">
          <h2>Last six months</h2>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Revenue and expenses by month">
            {series.map((s, i) => {
              const x = pad + i * bw;
              const h1 = (s.rev / max) * (H - 40);
              const h2 = (s.exp / max) * (H - 40);
              return (
                <g key={s.m}>
                  <rect x={x + 8} y={H - 24 - h1} width={bw / 2 - 10} height={h1} rx={3} fill="var(--leaf)">
                    <title>{`${monthLabel(s.m)} revenue ${money(s.rev)}`}</title>
                  </rect>
                  <rect x={x + bw / 2 + 2} y={H - 24 - h2} width={bw / 2 - 10} height={h2} rx={3} fill="var(--clay)" opacity={0.85}>
                    <title>{`${monthLabel(s.m)} expenses ${money(s.exp)}`}</title>
                  </rect>
                  <text x={x + bw / 2} y={H - 6} textAnchor="middle" fontSize={12} fill="var(--muted)" fontFamily="inherit">
                    {shortMonth(s.m)}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="lg">
            <span><i style={{ background: "var(--leaf)" }} />Revenue</span>
            <span><i style={{ background: "var(--clay)" }} />Expenses</span>
          </div>
        </div>
      </div>
      {c?.notes && (
        <p className="note" style={{ marginBottom: 22 }}>
          <b>Notes:</b> {c.notes}
        </p>
      )}

      <h2 className="section-title">Revenue by line, last six months</h2>
      <div className="table-wrap">
        <table className="lines-table">
          <thead>
            <tr>
              <th>Business line</th>
              {six.map((m) => (
                <th key={m}><Link href={`/finance?m=${m}`}>{shortMonth(m)}</Link></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id}>
                <td>
                  <button type="button" className="linkish dot-label" onClick={() => lineDrawer.openItem(l)} title="Edit business line">
                    <i style={{ background: colorVar(l.color) }} />
                    {l.name}
                    {!l.active && <span className="muted"> (hidden)</span>}
                  </button>
                </td>
                {six.map((m) => {
                  const v = main(entries.filter((e) => e.kind === "income" && e.business_line_id === l.id && e.entry_date.startsWith(m)));
                  return <td key={m} className={v ? "" : "muted"}>{v ? money(v) : "—"}</td>;
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              {series.map((s) => (
                <td key={s.m}>{money(s.rev)}</td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <h2 className="section-title">Budgets by sector</h2>
      {!sectors.length ? (
        <p className="muted" style={{ marginTop: 0 }}>
          No approved budgets yet. <Link href="/finance/budgets" className="linkish">Open Budgets</Link>
        </p>
      ) : (
        <div className="table-wrap">
          <table className="lines-table">
            <thead>
              <tr>
                <th>Sector</th>
                <th>Budgets</th>
                <th>Planned</th>
                <th>Spent</th>
                <th>Remaining</th>
                <th>Used</th>
              </tr>
            </thead>
            <tbody>
              {sectors.map((s) => {
                const pct = s.planned > 0 ? Math.round((s.spent / s.planned) * 100) : s.spent > 0 ? 100 : 0;
                return (
                  <tr key={s.id}>
                    <td><span className="dot-label"><i style={{ background: colorVar(s.color) }} />{s.name}</span></td>
                    <td>{s.budgets}</td>
                    <td>{budgetMoney(s.planned)}</td>
                    <td>{budgetMoney(s.spent)}</td>
                    <td style={s.planned - s.spent < 0 ? { color: "var(--danger)" } : undefined}>{budgetMoney(s.planned - s.spent)}</td>
                    <td>{pct}%</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td>{sectors.reduce((n, s) => n + s.budgets, 0)}</td>
                <td>{budgetMoney(sectors.reduce((n, s) => n + s.planned, 0))}</td>
                <td>{budgetMoney(sectors.reduce((n, s) => n + s.spent, 0))}</td>
                <td>{budgetMoney(sectors.reduce((n, s) => n + s.planned - s.spent, 0))}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <EntryDrawer target={target} lines={lines} currency={conv.to} today={k === thisMonth ? today : `${k}-01`} onClose={() => setTarget(null)} />

      <Drawer
        key={`cash-${k}`}
        title={`Cash in bank, ${monthLabel(k)}`}
        open={cashDrawer.open}
        onClose={cashDrawer.close}
        action={saveCash}
        footer={
          <>
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={cashDrawer.close}>Cancel</button>
            <button type="submit" className="btn primary">Save</button>
          </>
        }
      >
        <input type="hidden" name="month" value={k} />
        <div className="grid2">
          <div className="fld">
            <label htmlFor="c-cash">Cash in bank ({currency === "USD" ? "$" : "₡"})</label>
            <input id="c-cash" name="cash" type="number" step="any" defaultValue={c?.cash ?? ""} />
          </div>
          <div className="fld">
            <label htmlFor="c-date">As of</label>
            <input id="c-date" name="cash_date" type="date" defaultValue={c?.cash_date ?? ""} />
          </div>
        </div>
        <div className="fld">
          <label htmlFor="c-notes">Notes for the month</label>
          <textarea id="c-notes" name="notes" defaultValue={c?.notes ?? ""} placeholder="One-offs, context, anything the next person should know" />
        </div>
      </Drawer>

      <Drawer
        key={lineDrawer.item?.id ?? "new-line"}
        title={lineDrawer.item ? "Edit business line" : "Add a business line"}
        open={lineDrawer.open}
        onClose={lineDrawer.close}
        action={saveLine}
        footer={
          <>
            {lineDrawer.item && <ConfirmButton />}
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={lineDrawer.close}>Cancel</button>
            <button type="submit" className="btn primary">Save</button>
          </>
        }
      >
        {lineDrawer.item && <input type="hidden" name="id" value={lineDrawer.item.id} />}
        <div className="fld">
          <label htmlFor="l-name">Name</label>
          <input id="l-name" name="name" required defaultValue={lineDrawer.item?.name ?? ""} placeholder="e.g. Retreats" />
        </div>
        <div className="fld">
          <label htmlFor="l-color">Color</label>
          <select id="l-color" name="color" defaultValue={lineDrawer.item?.color ?? "slate"}>
            {COLORS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        {lineDrawer.item && (
          <label className="check">
            <input type="checkbox" name="active" defaultChecked={lineDrawer.item.active} />
            Show when adding transactions
          </label>
        )}
        <p className="muted" style={{ fontSize: 13 }}>
          Removing a line keeps its transactions; they become “Not assigned”.
        </p>
      </Drawer>
    </>
  );
}
