// Shapes and arithmetic for the farm shop Overview. The database does the
// totalling (public.shop_report); this turns its JSON into what the page
// draws: a filled-in day series (or weeks for long ranges), changes against
// the period before, and which products need a hand.

import { addDays, DOW, fmtDate, pd, weekStart } from "@/lib/dates";
import { lowState } from "@/lib/shop";

export type ReportDay = { day: string; revenue: number; orders: number; units: number };
export type ReportProduct = {
  id: string;
  name: string;
  category: string;
  unit: string | null;
  revenue: number;
  units: number;
  orders: number;
  last_sold: string;
};
export type ReportOrder = {
  id: string;
  at: string;
  amount: number;
  units: number;
  lines: number;
  method: string | null;
  buyer: string | null;
  summary: string;
};
export type Report = {
  totals: {
    revenue: number;
    orders: number;
    units: number;
    member_revenue: number;
    member_orders: number;
    buyers: number;
  };
  prev: { revenue: number; orders: number; units: number };
  days: ReportDay[];
  categories: { category: string; revenue: number; units: number }[];
  products: ReportProduct[];
  methods: { method: string; revenue: number; orders: number }[];
  hours: { hour: number; revenue: number; orders: number }[];
  weekdays: { dow: number; revenue: number; orders: number }[];
  buyers: { id: string; name: string | null; member: boolean; revenue: number; orders: number }[];
  recent: ReportOrder[];
};

export const EMPTY_REPORT: Report = {
  totals: { revenue: 0, orders: 0, units: 0, member_revenue: 0, member_orders: 0, buyers: 0 },
  prev: { revenue: 0, orders: 0, units: 0 },
  days: [],
  categories: [],
  products: [],
  methods: [],
  hours: [],
  weekdays: [],
  buyers: [],
  recent: [],
};

/** The report JSON with every number as a number (numerics arrive as such, but be safe). */
export function parseReport(json: unknown): Report {
  if (!json || typeof json !== "object") return EMPTY_REPORT;
  const r = json as Record<string, unknown>;
  const num = (v: unknown) => (v == null ? 0 : Number(v));
  const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
  const list = <T>(v: unknown, map: (x: Record<string, unknown>) => T): T[] =>
    Array.isArray(v) ? v.map((x) => map(obj(x))) : [];
  const t = obj(r.totals);
  const p = obj(r.prev);
  return {
    totals: {
      revenue: num(t.revenue),
      orders: num(t.orders),
      units: num(t.units),
      member_revenue: num(t.member_revenue),
      member_orders: num(t.member_orders),
      buyers: num(t.buyers),
    },
    prev: { revenue: num(p.revenue), orders: num(p.orders), units: num(p.units) },
    days: list(r.days, (x) => ({ day: String(x.day), revenue: num(x.revenue), orders: num(x.orders), units: num(x.units) })),
    categories: list(r.categories, (x) => ({ category: String(x.category), revenue: num(x.revenue), units: num(x.units) })),
    products: list(r.products, (x) => ({
      id: String(x.id),
      name: String(x.name),
      category: String(x.category),
      unit: x.unit == null ? null : String(x.unit),
      revenue: num(x.revenue),
      units: num(x.units),
      orders: num(x.orders),
      last_sold: String(x.last_sold),
    })),
    methods: list(r.methods, (x) => ({ method: String(x.method), revenue: num(x.revenue), orders: num(x.orders) })),
    hours: list(r.hours, (x) => ({ hour: num(x.hour), revenue: num(x.revenue), orders: num(x.orders) })),
    weekdays: list(r.weekdays, (x) => ({ dow: num(x.dow), revenue: num(x.revenue), orders: num(x.orders) })),
    buyers: list(r.buyers, (x) => ({
      id: String(x.id),
      name: x.name == null ? null : String(x.name),
      member: !!x.member,
      revenue: num(x.revenue),
      orders: num(x.orders),
    })),
    recent: list(r.recent, (x) => ({
      id: String(x.id),
      at: String(x.at),
      amount: num(x.amount),
      units: num(x.units),
      lines: num(x.lines),
      method: x.method == null ? null : String(x.method),
      buyer: x.buyer == null ? null : String(x.buyer),
      summary: String(x.summary ?? ""),
    })),
  };
}

/** Days between two YYYY-MM-DD dates, inclusive. */
export const spanDays = (from: string, to: string) =>
  Math.round((pd(to).getTime() - pd(from).getTime()) / 864e5) + 1;

/** One entry per calendar day in the range, zeros where nothing sold. */
export function fillDays(days: ReportDay[], from: string, to: string): ReportDay[] {
  const by = new Map(days.map((d) => [d.day, d]));
  const out: ReportDay[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    out.push(by.get(d) ?? { day: d, revenue: 0, orders: 0, units: 0 });
  }
  return out;
}

export type SeriesRow = { label: string; value: number; note?: string };

/** Revenue per day, or per week once the range is longer than a month. */
export function seriesFor(
  days: ReportDay[],
  from: string,
  to: string,
  pick: (d: ReportDay) => number = (d) => d.revenue,
): { rows: SeriesRow[]; unit: "day" | "week" } {
  const filled = fillDays(days, from, to);
  if (spanDays(from, to) <= 31) {
    return {
      unit: "day",
      rows: filled.map((d) => ({
        label: fmtDate(d.day, { month: "short", day: "numeric" }),
        value: pick(d),
        note: `${d.orders} order${d.orders === 1 ? "" : "s"}`,
      })),
    };
  }
  const weeks = new Map<string, { value: number; orders: number }>();
  for (const d of filled) {
    const k = weekStart(d.day);
    const w = weeks.get(k) ?? { value: 0, orders: 0 };
    w.value += pick(d);
    w.orders += d.orders;
    weeks.set(k, w);
  }
  return {
    unit: "week",
    rows: [...weeks].map(([k, w]) => ({
      label: fmtDate(k, { month: "short", day: "numeric" }),
      value: w.value,
      note: `week of ${fmtDate(k, { month: "short", day: "numeric" })}, ${w.orders} order${w.orders === 1 ? "" : "s"}`,
    })),
  };
}

/** Change against the period before as a fraction; null when there was nothing before. */
export const change = (cur: number, prev: number) => (prev > 0 ? (cur - prev) / prev : null);

/** "+12%" / "−8%" / "" for the KPI small print. */
export function fmtChange(cur: number, prev: number) {
  const c = change(cur, prev);
  if (c === null) return "";
  const p = Math.round(c * 100);
  return p === 0 ? "same as before" : `${p > 0 ? "+" : "−"}${Math.abs(p)}%`;
}

/** How many days the stock on hand lasts at the rate it sold over `days` days. */
export function daysOfCover(stock: number, unitsSold: number, days: number) {
  if (!(days > 0) || unitsSold <= 0) return null;
  return stock / (unitsSold / days);
}

export type StockProduct = {
  id: string;
  name: string;
  unit: string | null;
  stock: number;
  low_at: number;
  track_stock: boolean;
  price: number;
  online: boolean | null;
  category: string;
};

export type Attention = {
  id: string;
  name: string;
  unit: string | null;
  stock: number;
  state: "out" | "low" | "soon";
  cover: number | null;
  perDay: number;
};

/** Counted products that are out, low, or will run out within a week at the current pace. */
export function attention(products: StockProduct[], report: Report, days: number): Attention[] {
  const sold = new Map(report.products.map((p) => [p.id, p.units]));
  const out: Attention[] = [];
  for (const p of products) {
    if (!p.track_stock) continue;
    const units = sold.get(p.id) ?? 0;
    const cover = daysOfCover(Number(p.stock), units, days);
    const ls = lowState(p);
    const state = ls === "out" ? "out" : ls === "low" ? "low" : cover !== null && cover < 7 ? "soon" : null;
    if (!state) continue;
    out.push({ id: p.id, name: p.name, unit: p.unit, stock: Number(p.stock), state, cover, perDay: units / days });
  }
  const rank = { out: 0, low: 1, soon: 2 };
  return out.sort((a, b) => rank[a.state] - rank[b.state] || (a.cover ?? 1e9) - (b.cover ?? 1e9));
}

/** Products that didn't sell at all in the range (counted or sold online). */
export function slowMovers(products: StockProduct[], report: Report) {
  const sold = new Set(report.products.map((p) => p.id));
  return products.filter((p) => !sold.has(p.id)).sort((a, b) => a.name.localeCompare(b.name));
}

/** Retail value of everything counted. */
export const stockValue = (products: StockProduct[]) =>
  products.filter((p) => p.track_stock).reduce((n, p) => n + Number(p.stock) * Number(p.price), 0);

export const hourLabel = (h: number) => (h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`);
export const dowLabel = (d: number) => DOW[d] ?? "";

/** Orders by hour between the first and last hour anything sold (at least 7am to 6pm). */
export function hourRows(hours: Report["hours"], pick: (h: Report["hours"][number]) => number = (h) => h.orders) {
  const by = new Map(hours.map((h) => [h.hour, h]));
  const present = hours.map((h) => h.hour);
  const lo = Math.min(7, ...present);
  const hi = Math.max(18, ...present);
  const rows: SeriesRow[] = [];
  for (let h = lo; h <= hi; h++) {
    const x = by.get(h);
    rows.push({ label: hourLabel(h), value: x ? pick(x) : 0 });
  }
  return rows;
}

/** Monday to Sunday, in the order the week is lived here. */
export function weekdayRows(weekdays: Report["weekdays"], pick: (w: Report["weekdays"][number]) => number = (w) => w.revenue) {
  const by = new Map(weekdays.map((w) => [w.dow, w]));
  return [1, 2, 3, 4, 5, 6, 0].map((d) => {
    const w = by.get(d);
    return { label: dowLabel(d), value: w ? pick(w) : 0, note: w ? `${w.orders} order${w.orders === 1 ? "" : "s"}` : undefined };
  });
}

/** Start of a Costa Rica calendar day as an ISO timestamp (no daylight saving there). */
export const crStart = (day: string) => new Date(`${day}T00:00:00-06:00`).toISOString();

/** "Oct 5, 2:59pm" in Costa Rica time. */
export const fmtWhen = (iso: string) =>
  new Date(iso)
    .toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/Costa_Rica",
    })
    .replace(" AM", "am")
    .replace(" PM", "pm");
