"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Drawer, useDrawer } from "@/components/drawer";
import type { Tables } from "@/lib/database.types";
import { addMonths, fmtDate, monthLabel, shortMonth } from "@/lib/dates";
import { fmtMoney } from "@/lib/shop";
import { saveMonth } from "./actions";

type Month = Tables<"finance_months"> & { key: string };

const REV_LINES = [
  ["membership", "Memberships"],
  ["events", "Events & classes"],
  ["shop", "Farm shop"],
  ["fnb", "Food & beverage"],
  ["land", "Land sales"],
  ["other", "Other"],
] as const;

const revTotal = (f: Partial<Month>) =>
  REV_LINES.reduce((n, [k]) => n + Number(f[k] ?? 0), 0);

export function FinanceView({
  month: k,
  months,
  ticketSales,
  currency,
  prev,
  next,
  thisMonth,
}: {
  month: string;
  months: Month[];
  ticketSales: number;
  currency: string;
  prev: string;
  next: string;
  thisMonth: string;
}) {
  const drawer = useDrawer<string>();
  const router = useRouter();
  const money = (n: number | null | undefined) => fmtMoney(n, currency);
  const f: Partial<Month> = months.find((x) => x.key === k) ?? {};
  const rev = revTotal(f);
  const exp = Number(f.expenses ?? 0);
  const net = rev - exp;

  const series = Array.from({ length: 6 }, (_, i) => {
    const m = addMonths(k, i - 5);
    const d = months.find((x) => x.key === m) ?? {};
    return { m, rev: revTotal(d), exp: Number((d as Partial<Month>).expenses ?? 0) };
  });
  const max = Math.max(1, ...series.flatMap((s) => [s.rev, s.exp]));
  const W = 520;
  const H = 180;
  const pad = 24;
  const bw = (W - pad * 2) / 6;

  const kpi = (label: string, val: number | null | undefined, cls = "", small = "") => (
    <div className={`kpi ${cls}`}>
      <span>{label}</span>
      <b>{money(val)}</b>
      {small && <small>{small}</small>}
    </div>
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Finance</h1>
          <p className="lede">
            Monthly revenue, expenses, receivables, payables, and cash. Admins
            only.
          </p>
        </div>
        <div className="head-actions">
          <button type="button" className="btn primary" onClick={() => drawer.openItem(k)}>
            {f.updated_at ? `Edit ${shortMonth(k)}` : `Enter ${shortMonth(k)} figures`}
          </button>
        </div>
      </div>
      <div className="monthnav">
        <span className="range">{monthLabel(k)}</span>
        <Link className="btn" href={`/finance?m=${prev}`}>Previous</Link>
        <Link className="btn" href={`/finance?m=${thisMonth}`}>This month</Link>
        <Link className="btn" href={`/finance?m=${next}`}>Next</Link>
      </div>
      {!f.updated_at && (
        <div className="banner">
          No figures entered for {monthLabel(k)} yet. Use the button above to add them.
        </div>
      )}
      <div className="kpis">
        {kpi("Revenue", rev, "", ticketSales ? `${money(ticketSales)} in ticket sales marked paid in ARK OS` : "")}
        {kpi("Expenses", exp)}
        {kpi("Net", net, net < 0 ? "neg" : net > 0 ? "pos" : "")}
        {kpi("Cash in bank", f.cash, "", f.cash_date ? `as of ${fmtDate(f.cash_date)}` : "")}
        {kpi("Accounts receivable", f.ar, "", "owed to The ARK")}
        {kpi("Accounts payable", f.ap, "", "The ARK owes")}
      </div>
      <div className="fin-grid">
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
        <div className="brk">
          <h2>Revenue by line</h2>
          {REV_LINES.map(([key, l]) => (
            <div className="ln" key={key}>
              <span>{l}</span>
              <span>{money(f[key])}</span>
            </div>
          ))}
          <div className="ln">
            <span><b>Total</b></span>
            <span><b>{money(rev)}</b></span>
          </div>
        </div>
      </div>
      {f.notes && (
        <p className="note" style={{ marginBottom: 22 }}>
          <b>Notes:</b> {f.notes}
        </p>
      )}
      <h2 className="section-title">All months</h2>
      {months.length ? (
        <div className="list">
          <div className="row head frow">
            <span>Month</span>
            <span>Revenue</span>
            <span>Expenses</span>
            <span className="c-ar">Receivable</span>
            <span className="c-ap">Payable</span>
            <span className="c-cash">Cash</span>
          </div>
          {months.map((d) => (
            <button type="button" className="row frow" key={d.key} onClick={() => router.push(`/finance?m=${d.key}`)}>
              <span><b>{monthLabel(d.key)}</b></span>
              <span>{money(revTotal(d))}</span>
              <span>{money(d.expenses)}</span>
              <span className="c-ar">{money(d.ar)}</span>
              <span className="c-ap">{money(d.ap)}</span>
              <span className="c-cash">{money(d.cash)}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty"><p>No months recorded yet.</p></div>
      )}

      <Drawer
        key={k}
        title={`${f.updated_at ? "Edit" : "Enter"} ${monthLabel(k)}`}
        open={drawer.open}
        onClose={drawer.close}
        action={saveMonth}
        footer={
          <>
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={drawer.close}>Cancel</button>
            <button type="submit" className="btn primary">Save {monthLabel(k)}</button>
          </>
        }
      >
        <input type="hidden" name="month" value={k} />
        <p className="muted" style={{ marginTop: 0 }}>
          All amounts in {currency === "USD" ? "US dollars" : "colones"}. Leave a
          field empty if it doesn’t apply.
        </p>
        <div className="subhead" style={{ borderTop: 0, paddingTop: 0, marginTop: 4 }}>Revenue</div>
        <div className="grid2">
          {REV_LINES.map(([key, l]) => (
            <Num key={key} name={key} label={l} value={f[key]} />
          ))}
        </div>
        <div className="subhead">Costs &amp; position</div>
        <div className="grid2">
          <Num name="expenses" label="Total expenses" value={f.expenses} />
          <Num name="cash" label="Cash in bank" value={f.cash} />
        </div>
        <div className="grid2">
          <Num name="ar" label="Accounts receivable" value={f.ar} hint="Invoices owed to The ARK" />
          <Num name="ap" label="Accounts payable" value={f.ap} hint="Bills The ARK still owes" />
        </div>
        <div className="fld">
          <label htmlFor="f-cashDate">Cash balance as of</label>
          <input id="f-cashDate" name="cash_date" type="date" defaultValue={f.cash_date ?? ""} />
        </div>
        <div className="fld">
          <label htmlFor="f-notes">Notes</label>
          <textarea id="f-notes" name="notes" defaultValue={f.notes ?? ""} placeholder="One-offs, context, anything the next person should know" />
        </div>
      </Drawer>
    </>
  );
}

function Num({
  name,
  label,
  value,
  hint,
}: {
  name: string;
  label: string;
  value: number | null | undefined;
  hint?: string;
}) {
  return (
    <div className="fld">
      <label htmlFor={`f-${name}`}>{label}</label>
      <input id={`f-${name}`} name={name} type="number" min={0} step="any" defaultValue={value ?? ""} />
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}
