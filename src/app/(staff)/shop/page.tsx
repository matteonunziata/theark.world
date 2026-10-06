import type { Metadata } from "next";
import Link from "next/link";
import { BarList, Columns, TimeSeries } from "@/components/charts";
import { RangePicker } from "@/components/range-picker";
import { recentPresets } from "@/lib/range-presets";
import { requireStaff } from "@/lib/auth";
import { addDays, fmtDate, todayIn } from "@/lib/dates";
import { fmtCompact, fmtMoney, lowState, shopMethodName } from "@/lib/shop";
import {
  type Attention,
  attention,
  change,
  fmtChange,
  fmtWhen,
  hourRows,
  parseReport,
  seriesFor,
  slowMovers,
  spanDays,
  stockValue,
  weekdayRows,
} from "@/lib/shop-report";

export const metadata: Metadata = { title: "Farm shop" };

const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

export default async function ShopOverview({ searchParams }: PageProps<"/shop">) {
  const sp = await searchParams;
  const today = todayIn();
  const to = isDay(sp.to) ? sp.to : today;
  const from = isDay(sp.from) && sp.from <= to ? sp.from : addDays(to, -29);
  const { supabase } = await requireStaff("shop");
  const [{ data: json }, { data: products }, { data: org }] = await Promise.all([
    supabase.rpc("shop_report", { p_from: from, p_to: to }),
    supabase
      .from("products")
      .select("id, name, unit, stock, low_at, track_stock, price, online, category")
      .eq("active", true)
      .order("name"),
    supabase.rpc("public_org").maybeSingle(),
  ]);
  const r = parseReport(json);
  const cur = org?.currency ?? "CRC";
  const money = (n: number) => fmtMoney(n, cur);
  const days = spanDays(from, to);
  const series = seriesFor(r.days, from, to);
  const list = products ?? [];
  const att = attention(list, r, days);
  const slow = slowMovers(list, r);
  const avg = r.totals.orders ? r.totals.revenue / r.totals.orders : 0;
  const prevAvg = r.prev.orders ? r.prev.revenue / r.prev.orders : 0;
  const memberShare = r.totals.revenue ? Math.round((r.totals.member_revenue / r.totals.revenue) * 100) : 0;
  const counted = list.filter((p) => p.track_stock).length;
  const low = list.filter((p) => lowState(p)).length;
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

  return (
    <>
      <RangePicker from={from} to={to} today={today} presets={recentPresets(today)} />

      {!r.totals.orders && (
        <div className="banner">
          No sales recorded between {fmtDate(from)} and {fmtDate(to)}. Sales go through{" "}
          <Link href="/shop/sales">the till on the Sales tab</Link>; the figures fill in here as they come.
        </div>
      )}

      <div className="kpis shop-kpis">
        <Kpi label="Revenue" value={money(r.totals.revenue)} cur={r.totals.revenue} prev={r.prev.revenue} days={days} />
        <Kpi label="Orders" value={String(r.totals.orders)} cur={r.totals.orders} prev={r.prev.orders} days={days} />
        <Kpi label="Average order" value={money(avg)} cur={avg} prev={prevAvg} days={days} />
        <Kpi label="Items sold" value={String(r.totals.units)} cur={r.totals.units} prev={r.prev.units} days={days} />
        <Kpi
          label="Member sales"
          value={`${memberShare}%`}
          small={
            r.totals.member_orders
              ? `${plural(r.totals.member_orders, "order")} by active members`
              : r.totals.buyers
                ? `${plural(r.totals.buyers, "buyer")} named, none members`
                : "Pick “Sold to” on a sale to see this"
          }
        />
        <Kpi
          label="Stock at retail"
          value={money(stockValue(list))}
          small={counted ? `${plural(counted, "product")} counted · ${low} low or out` : "Nothing counted yet"}
        />
      </div>

      <div className="shop-grid">
        <div className="chart">
          <h2>
            Revenue by {series.unit}
            <span className="mini">{money(r.totals.revenue)}</span>
          </h2>
          <TimeSeries rows={series.rows} format={money} axis={(n) => fmtCompact(n, cur)} label={`Revenue by ${series.unit}`} />
          <p className="chart-sub muted" style={{ marginTop: 10 }}>
            {fmtDate(from, { month: "short", day: "numeric" })} to {fmtDate(to, { month: "short", day: "numeric", year: "numeric" })}.
            Hover a column for the figure.
          </p>
        </div>
        <div className="panel">
          <h2>
            Needs attention
            {att.length > 0 && (
              <Link className="mini" href="/shop/products?low=1">
                Restock
              </Link>
            )}
          </h2>
          {att.length ? (
            <>
              <ul className="att">
                {att.slice(0, 8).map((a) => (
                  <li key={a.id}>
                    <span>{a.name}</span>
                    <span className={`st ${a.state}`}>{attentionLabel(a)}</span>
                  </li>
                ))}
              </ul>
              {att.length > 8 && (
                <p className="muted" style={{ margin: "8px 0 0", fontSize: 13 }}>
                  and {att.length - 8} more
                </p>
              )}
            </>
          ) : counted ? (
            <p className="muted" style={{ margin: 0 }}>
              Everything counted is above its alert level and should last the week at the current pace.
            </p>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              Nothing is being counted yet. Tick “Count stock” on a product and set an alert level to see
              what’s running low here.
            </p>
          )}
        </div>
      </div>

      <div className="panel-grid">
        <div className="panel">
          <h2>Top products</h2>
          <BarList
            format={money}
            empty="Nothing sold in this range."
            rows={r.products.slice(0, 10).map((p) => ({
              label: p.name,
              value: p.revenue,
              note: `${plural(p.units, "item")} in ${plural(p.orders, "order")}`,
            }))}
          />
        </div>
        <div className="panel">
          <h2>By category</h2>
          <BarList
            format={money}
            empty="Nothing sold in this range."
            rows={r.categories.map((c) => ({ label: c.category, value: c.revenue, note: plural(c.units, "item") }))}
          />
        </div>
        <div className="panel">
          <h2>Busiest days</h2>
          <BarList format={money} empty="Nothing sold in this range." rows={weekdayRows(r.weekdays)} />
        </div>
        <div className="panel">
          <h2>Orders by hour</h2>
          {r.hours.length ? (
            <Columns rows={hourRows(r.hours)} label="Orders by hour" />
          ) : (
            <p className="muted" style={{ margin: 0 }}>Nothing sold in this range.</p>
          )}
        </div>
        <div className="panel">
          <h2>How people pay</h2>
          <BarList
            format={money}
            empty="No sales with a payment method yet."
            rows={r.methods.map((m) => ({ label: shopMethodName(m.method), value: m.revenue, note: plural(m.orders, "order") }))}
          />
        </div>
        <div className="panel">
          <h2>Top buyers</h2>
          <BarList
            format={money}
            empty="Pick “Sold to” when recording a sale and the regulars show up here."
            rows={r.buyers.map((b, i) => ({
              label: b.name ?? `A contact (${i + 1})`,
              value: b.revenue,
              note: `${plural(b.orders, "order")}${b.member ? " · member" : ""}`,
            }))}
          />
        </div>
      </div>

      <div className="panel">
        <h2>
          Recent orders
          <Link className="mini" href={`/shop/sales?from=${from}&to=${to}`}>
            All sales
          </Link>
        </h2>
        {r.recent.length ? (
          <div className="list">
            <div className="row head orow">
              <span>When</span>
              <span>What</span>
              <span>Who</span>
              <span>Paid</span>
              <span style={{ textAlign: "right" }}>Amount</span>
            </div>
            {r.recent.map((o) => (
              <div className="row orow static" key={o.id}>
                <span>{fmtWhen(o.at)}</span>
                <span className="sum" title={o.summary}>
                  {o.summary}
                </span>
                <span className="meta">{o.buyer ?? "Walk-in"}</span>
                <span className="meta">{shopMethodName(o.method)}</span>
                <span className="amt">{money(o.amount)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted" style={{ margin: 0 }}>No orders in this range.</p>
        )}
      </div>

      {days >= 7 && slow.length > 0 && (
        <div className="panel">
          <h2>
            Didn’t sell
            <Link className="mini" href="/shop/products">
              Products
            </Link>
          </h2>
          <p className="muted" style={{ margin: "0 0 8px", fontSize: 13.5 }}>
            {plural(slow.length, "product")} with no sales in these {days} days
            {slow.length > list.length / 2 ? ", so most of the catalog moves online or not at all" : ""}.
          </p>
          <p style={{ margin: 0, fontSize: 14 }}>
            {slow.slice(0, 14).map((p) => p.name).join(" · ")}
            {slow.length > 14 ? ` · and ${slow.length - 14} more` : ""}
          </p>
        </div>
      )}
    </>
  );
}

function attentionLabel(a: Attention) {
  const unit = a.unit ? ` ${a.unit}` : "";
  if (a.state === "out") return "Out of stock";
  if (a.state === "low") return `${a.stock}${unit} left`;
  return `${a.stock}${unit} · about ${Math.max(1, Math.round(a.cover ?? 0))} days`;
}

function Kpi({
  label,
  value,
  small,
  cur,
  prev,
  days,
}: {
  label: string;
  value: string;
  small?: string;
  cur?: number;
  prev?: number;
  days?: number;
}) {
  let note: React.ReactNode = small;
  if (cur !== undefined && prev !== undefined && days) {
    const t = fmtChange(cur, prev);
    const c = change(cur, prev);
    note = t ? (
      <>
        <span className={`delta ${c !== null && c > 0.005 ? "up" : c !== null && c < -0.005 ? "down" : ""}`}>{t}</span>
        vs the {days} days before
      </>
    ) : (
      "Nothing to compare with yet"
    );
  }
  return (
    <div className="kpi">
      <span>{label}</span>
      <b>{value}</b>
      {note && <small>{note}</small>}
    </div>
  );
}
