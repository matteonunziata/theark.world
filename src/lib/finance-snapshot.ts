import { addMonths } from "@/lib/dates";
import { type Conv, convert, type Entry, overdueDays } from "@/lib/finance";

type E = Pick<
  Entry,
  "kind" | "amount" | "currency" | "entry_date" | "status" | "due_date" | "category" | "business_line_id"
>;

/** Change from `prev` to `cur` as a fraction of |prev|; null when there is nothing to compare to. */
export const pctChange = (cur: number, prev: number) =>
  prev === 0 ? null : (cur - prev) / Math.abs(prev);

export type Slice = { key: string; label: string; amount: number; share: number };

export type Snapshot = {
  /** True when anything shown was converted between currencies. */
  approx: boolean;
  month: { rev: number; exp: number; net: number; margin: number | null };
  prev: { rev: number; exp: number; net: number };
  delta: { rev: number | null; exp: number | null; net: number | null };
  ytd: { rev: number; exp: number; net: number; margin: number | null };
  attention: {
    overdueAR: { n: number; amount: number };
    overdueAP: { n: number; amount: number };
    dueSoonAP: { n: number; amount: number };
    dueSoonAR: { n: number; amount: number };
  };
  /** Average monthly spending over the last three months with expenses, and cash ÷ that. */
  runway: { avgExpenses: number | null; months: number | null };
  topExpenses: Slice[];
  revenueMix: Slice[];
};

/**
 * Everything the Overview snapshot shows, in the currency being viewed.
 * Months are "YYYY-MM"; `today` is "YYYY-MM-DD" and decides what is overdue.
 */
export function buildSnapshot({
  entries,
  month,
  today,
  conv,
  cash,
  lineName,
  soonDays = 7,
}: {
  entries: E[];
  month: string;
  today: string;
  conv: Conv;
  /** Latest cash in bank, already in the viewing currency. */
  cash: number | null;
  lineName: (id: string | null) => string;
  soonDays?: number;
}): Snapshot {
  let approx = false;
  const amt = (e: E) => {
    if (e.currency !== conv.to) approx = true;
    return convert(Number(e.amount), e.currency, conv);
  };
  const sum = (es: E[]) => es.reduce((s, e) => s + amt(e), 0);
  const inMonth = (m: string) => entries.filter((e) => e.entry_date.startsWith(m));
  const split = (es: E[]) => {
    const rev = sum(es.filter((e) => e.kind === "income"));
    const exp = sum(es.filter((e) => e.kind === "expense"));
    return { rev, exp, net: rev - exp };
  };

  const cur = split(inMonth(month));
  const prev = split(inMonth(addMonths(month, -1)));

  const year = month.slice(0, 4);
  const ytdEntries = entries.filter(
    (e) => e.entry_date.startsWith(year) && e.entry_date.slice(0, 7) <= month,
  );
  const ytd = split(ytdEntries);

  const open = entries.filter((e) => e.status === "unpaid");
  const bucket = (kind: string, test: (days: number) => boolean) => {
    const es = open.filter((e) => {
      if (e.kind !== kind) return false;
      const d = overdueDays(e.due_date, today);
      return d !== null && test(d);
    });
    return { n: es.length, amount: sum(es) };
  };

  // Spending over the three months before the one being viewed (only months with spending).
  const before = [1, 2, 3]
    .map((i) => sum(inMonth(addMonths(month, -i)).filter((e) => e.kind === "expense")))
    .filter((v) => v > 0);
  const avgExpenses = before.length ? before.reduce((a, b) => a + b, 0) / before.length : null;

  const slices = (es: E[], key: (e: E) => { key: string; label: string }, limit: number): Slice[] => {
    const by = new Map<string, Slice>();
    for (const e of es) {
      const k = key(e);
      const s = by.get(k.key) ?? { key: k.key, label: k.label, amount: 0, share: 0 };
      s.amount += amt(e);
      by.set(k.key, s);
    }
    const all = [...by.values()].sort((a, b) => b.amount - a.amount);
    const total = all.reduce((s, x) => s + x.amount, 0);
    const top = all.slice(0, limit);
    const rest = all.slice(limit).reduce((s, x) => s + x.amount, 0);
    if (rest > 0) top.push({ key: "__other", label: "Everything else", amount: rest, share: 0 });
    return top.map((s) => ({ ...s, share: total > 0 ? s.amount / total : 0 }));
  };
  const thisMonth = inMonth(month);

  return {
    approx,
    month: { ...cur, margin: cur.rev > 0 ? cur.net / cur.rev : null },
    prev,
    delta: {
      rev: pctChange(cur.rev, prev.rev),
      exp: pctChange(cur.exp, prev.exp),
      net: pctChange(cur.net, prev.net),
    },
    ytd: { ...ytd, margin: ytd.rev > 0 ? ytd.net / ytd.rev : null },
    attention: {
      overdueAR: bucket("income", (d) => d > 0),
      overdueAP: bucket("expense", (d) => d > 0),
      dueSoonAP: bucket("expense", (d) => d <= 0 && d >= -soonDays),
      dueSoonAR: bucket("income", (d) => d <= 0 && d >= -soonDays),
    },
    runway: {
      avgExpenses,
      months: cash !== null && cash > 0 && avgExpenses ? cash / avgExpenses : null,
    },
    topExpenses: slices(
      thisMonth.filter((e) => e.kind === "expense"),
      (e) => ({ key: e.category ?? "", label: e.category ?? "No category" }),
      5,
    ),
    revenueMix: slices(
      thisMonth.filter((e) => e.kind === "income"),
      (e) => ({ key: e.business_line_id ?? "", label: lineName(e.business_line_id) }),
      6,
    ),
  };
}
