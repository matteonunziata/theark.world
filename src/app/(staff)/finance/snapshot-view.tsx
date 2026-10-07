import Link from "next/link";
import { type Conv } from "@/lib/finance";
import type { Snapshot } from "@/lib/finance-snapshot";
import { fmtMoney } from "@/lib/shop";
import type { SectorRollup } from "./budgets/rollup";

export type Attention = {
  pendingBudgets: number;
  requests: number;
  /** Colones asked for in open payment requests. */
  requestsCrc: number;
};

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** "▲ 12% vs Sep"; `goodWhenUp` says whether going up is good news (revenue) or bad (expenses). */
export function Delta({
  change,
  versus,
  goodWhenUp,
}: {
  change: number | null;
  versus: string;
  goodWhenUp: boolean;
}) {
  if (change === null) return <span className="delta">no {versus} to compare</span>;
  const up = change > 0.0005;
  const down = change < -0.0005;
  if (!up && !down) return <span className="delta">no change vs {versus}</span>;
  const good = up === goodWhenUp;
  return (
    <span className={`delta ${good ? "good" : "bad"}`}>
      {up ? "▲" : "▼"} {pct(Math.abs(change))} vs {versus}
    </span>
  );
}

function Bars({
  rows,
  money,
  color,
}: {
  rows: Snapshot["topExpenses"];
  money: (n: number) => string;
  color: (key: string) => string;
}) {
  if (!rows.length) return <p className="muted" style={{ margin: 0 }}>Nothing recorded this month.</p>;
  const max = Math.max(...rows.map((r) => r.amount), 1);
  return (
    <ul className="snap-bars">
      {rows.map((r) => (
        <li key={r.key}>
          <span className="l" title={r.label}>{r.label}</span>
          <span className="track">
            <span style={{ width: `${Math.max(2, (r.amount / max) * 100)}%`, background: color(r.key) }} />
          </span>
          <span className="v">{money(r.amount)}<small>{pct(r.share)}</small></span>
        </li>
      ))}
    </ul>
  );
}

export function SnapshotView({
  snap,
  attention,
  sectors,
  conv,
  monthName,
  prevName,
  cash,
  lineColor,
  isLatest,
}: {
  snap: Snapshot;
  attention: Attention;
  sectors: SectorRollup[];
  conv: Conv;
  monthName: string;
  prevName: string;
  /** Cash in bank in the viewing currency, and when it was recorded. */
  cash: { value: number | null; date: string | null };
  lineColor: (id: string) => string;
  isLatest: boolean;
}) {
  const money = (n: number) => fmtMoney(n, conv.to);
  const a = snap.attention;
  const mark = snap.approx ? "~" : "";
  const crcMark = conv.to === "CRC" ? "" : "~";
  const budgetMoney = (crc: number) => crcMark + fmtMoney(conv.to === "USD" ? crc / conv.rate : crc, conv.to);

  const planned = sectors.reduce((s, x) => s + x.planned, 0);
  const spent = sectors.reduce((s, x) => s + x.spent, 0);
  const over = sectors.filter((x) => x.planned > 0 && x.spent > x.planned);
  const near = sectors.filter((x) => x.planned > 0 && x.spent <= x.planned && x.spent / x.planned >= 0.9);

  const items: { tone: "bad" | "warn" | "info"; text: React.ReactNode }[] = [];
  if (a.overdueAR.n) items.push({ tone: "bad", text: <>{a.overdueAR.n} overdue invoice{a.overdueAR.n === 1 ? "" : "s"} · <b>{mark}{money(a.overdueAR.amount)}</b> owed to The ARK</> });
  if (a.overdueAP.n) items.push({ tone: "bad", text: <>{a.overdueAP.n} overdue bill{a.overdueAP.n === 1 ? "" : "s"} · <b>{mark}{money(a.overdueAP.amount)}</b> to pay</> });
  if (a.dueSoonAP.n) items.push({ tone: "warn", text: <>{a.dueSoonAP.n} bill{a.dueSoonAP.n === 1 ? "" : "s"} due in the next 7 days · <b>{mark}{money(a.dueSoonAP.amount)}</b></> });
  if (a.dueSoonAR.n) items.push({ tone: "info", text: <>{a.dueSoonAR.n} invoice{a.dueSoonAR.n === 1 ? "" : "s"} due in the next 7 days · <b>{mark}{money(a.dueSoonAR.amount)}</b> expected</> });
  if (attention.pendingBudgets) items.push({ tone: "warn", text: <><Link href="/finance/queue" className="linkish">{attention.pendingBudgets} budget{attention.pendingBudgets === 1 ? "" : "s"} waiting for approval</Link></> });
  if (attention.requests) items.push({ tone: "warn", text: <><Link href="/finance/queue" className="linkish">{attention.requests} payment request{attention.requests === 1 ? "" : "s"} to pay</Link> · <b>{budgetMoney(attention.requestsCrc)}</b></> });
  if (over.length) items.push({ tone: "bad", text: <>Over plan: {over.map((s) => s.name).join(", ")}</> });
  if (near.length) items.push({ tone: "warn", text: <>Close to plan (90%+): {near.map((s) => s.name).join(", ")}</> });

  const runway = snap.runway.months;
  const runwayTone = runway === null ? "" : runway < 3 ? "bad" : runway < 6 ? "warn" : "good";

  return (
    <>
      <h2 className="section-title">Snapshot</h2>
      <div className="snap-grid">
        <section className="snap-card">
          <h3>Needs attention</h3>
          {!items.length ? (
            <p className="muted" style={{ margin: 0 }}>
              Nothing overdue or waiting. {isLatest ? "" : "Overdue and due-soon items are as of today."}
            </p>
          ) : (
            <ul className="snap-list">
              {items.map((it, i) => (
                <li key={i} className={it.tone}><i aria-hidden />{it.text}</li>
              ))}
            </ul>
          )}
        </section>

        <section className="snap-card">
          <h3>Cash and runway</h3>
          <div className="snap-big">
            {cash.value !== null ? money(cash.value) : "—"}
            <small>{cash.value !== null ? `in the bank${cash.date ? `, as of ${cash.date}` : ""}` : "Record cash in bank to see runway"}</small>
          </div>
          <dl className="snap-dl">
            <div>
              <dt>Average spending</dt>
              <dd>{snap.runway.avgExpenses !== null ? `${mark}${money(snap.runway.avgExpenses)}/month` : "—"}</dd>
            </div>
            <div>
              <dt>Runway</dt>
              <dd className={runwayTone}>
                {runway !== null ? `${runway >= 10 ? Math.round(runway) : runway.toFixed(1)} months` : "—"}
              </dd>
            </div>
          </dl>
          <small className="muted">Runway is cash in bank divided by spending over the three months before {monthName}.</small>
        </section>

        <section className="snap-card">
          <h3>Compared with {prevName}</h3>
          <dl className="snap-dl">
            <div>
              <dt>Revenue</dt>
              <dd>{mark}{money(snap.month.rev)} <Delta change={snap.delta.rev} versus={prevName} goodWhenUp /></dd>
            </div>
            <div>
              <dt>Expenses</dt>
              <dd>{mark}{money(snap.month.exp)} <Delta change={snap.delta.exp} versus={prevName} goodWhenUp={false} /></dd>
            </div>
            <div>
              <dt>Net</dt>
              <dd className={snap.month.net < 0 ? "bad" : ""}>{mark}{money(snap.month.net)} <Delta change={snap.delta.net} versus={prevName} goodWhenUp /></dd>
            </div>
            <div>
              <dt>Margin</dt>
              <dd>{snap.month.margin !== null ? pct(snap.month.margin) : "—"}</dd>
            </div>
          </dl>
        </section>

        <section className="snap-card">
          <h3>Year to date</h3>
          <dl className="snap-dl">
            <div><dt>Revenue</dt><dd>{mark}{money(snap.ytd.rev)}</dd></div>
            <div><dt>Expenses</dt><dd>{mark}{money(snap.ytd.exp)}</dd></div>
            <div><dt>Net</dt><dd className={snap.ytd.net < 0 ? "bad" : ""}>{mark}{money(snap.ytd.net)}</dd></div>
            <div><dt>Margin</dt><dd>{snap.ytd.margin !== null ? pct(snap.ytd.margin) : "—"}</dd></div>
          </dl>
          <small className="muted">January through {monthName}.</small>
        </section>

        <section className="snap-card">
          <h3>Where the money went, {monthName}</h3>
          <Bars rows={snap.topExpenses} money={(n) => mark + money(n)} color={(k) => (k === "__other" ? "var(--slate)" : "var(--clay)")} />
        </section>

        <section className="snap-card">
          <h3>Where revenue came from, {monthName}</h3>
          <Bars rows={snap.revenueMix} money={(n) => mark + money(n)} color={(k) => (k && k !== "__other" ? lineColor(k) : "var(--slate)")} />
        </section>

        <section className="snap-card">
          <h3>Sector budgets</h3>
          {!sectors.length ? (
            <p className="muted" style={{ margin: 0 }}>
              No approved budgets yet. <Link href="/finance/budgets" className="linkish">Open Budgets</Link>
            </p>
          ) : (
            <>
              <div className="snap-big">
                {planned > 0 ? pct(spent / planned) : "—"}
                <small>of {budgetMoney(planned)} planned is used</small>
              </div>
              <div className={`meter ${planned > 0 && spent > planned ? "over" : planned > 0 && spent / planned >= 0.9 ? "warn" : ""}`}>
                <span style={{ width: `${planned > 0 ? Math.min(100, (spent / planned) * 100) : 0}%` }} />
              </div>
              <dl className="snap-dl">
                <div><dt>Spent or committed</dt><dd>{budgetMoney(spent)}</dd></div>
                <div><dt>Remaining</dt><dd className={planned - spent < 0 ? "bad" : ""}>{budgetMoney(planned - spent)}</dd></div>
              </dl>
              <Link href="/finance/budgets" className="linkish" style={{ fontSize: 13 }}>Open Budgets</Link>
            </>
          )}
        </section>
      </div>
      {snap.approx && (
        <p className="muted" style={{ fontSize: 13, margin: "6px 0 22px" }}>
          “~” marks figures that include amounts converted at ₡{conv.rate.toLocaleString("en-US")} = $1.
        </p>
      )}
    </>
  );
}
