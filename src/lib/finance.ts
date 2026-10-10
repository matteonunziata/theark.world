import type { Tables } from "@/lib/database.types";
import { fmtMoney } from "@/lib/shop";

export type Entry = Tables<"finance_entries"> & {
  contact?: { id: string; name: string } | null;
  lot?: { id: string; code: string; name: string | null } | null;
};
export type Line = Tables<"business_lines">;

export const METHODS = [
  ["transfer", "Bank transfer"],
  ["sinpe", "SINPE Móvil"],
  ["card", "Card"],
  ["cash", "Cash"],
  ["other", "Other"],
] as const;

export const DOC_KINDS = [
  ["receipt", "Receipt"],
  ["invoice", "Invoice"],
  ["bill", "Bill"],
] as const;

export const CATEGORY_HINTS = {
  income: ["Membership dues", "Tickets", "Shop sales", "Food & drink", "Tuition", "Rent", "Land sale", "Other"],
  expense: ["Payroll", "Supplies", "Farm inputs", "Utilities", "Maintenance", "Marketing", "Professional services", "Rent", "Taxes & fees", "Equipment", "Other"],
} as const;

export const methodName = (k: string | null | undefined) =>
  METHODS.find((m) => m[0] === k)?.[1] ?? "—";
export const docName = (k: string | null | undefined) =>
  DOC_KINDS.find((d) => d[0] === k)?.[1] ?? "Document";

/** Amounts per currency, so colones and dollars never get added together. */
export type Totals = Record<string, number>;

export function totals(entries: Pick<Entry, "amount" | "currency">[]): Totals {
  const t: Totals = {};
  for (const e of entries) t[e.currency] = (t[e.currency] ?? 0) + Number(e.amount);
  return t;
}

/** "₡1,200,000" or "₡1,200,000 + $300"; main currency first. */
export function fmtTotals(t: Totals, main = "CRC") {
  const parts = [main, ...Object.keys(t).filter((c) => c !== main)]
    .filter((c, i) => i === 0 || t[c])
    .map((c) => fmtMoney(t[c] ?? 0, c));
  return parts.join(" + ");
}

/** How Finance is being viewed: the currency shown, and colones per dollar. */
export type Conv = { to: "CRC" | "USD"; rate: number };

export function convert(amount: number, from: string, c: Conv) {
  if (from === c.to) return amount;
  return c.to === "USD" ? amount / c.rate : amount * c.rate;
}

/** Everything added up in the viewing currency; `approx` if any of it was converted. */
export function sumIn(
  entries: Pick<Entry, "amount" | "currency">[],
  c: Conv,
) {
  let value = 0;
  let approx = false;
  for (const e of entries) {
    if (e.currency !== c.to) approx = true;
    value += convert(Number(e.amount), e.currency, c);
  }
  return { value, approx };
}

/** "₡1,200,000", or "~₡1,200,000" when some of it was converted. */
export function fmtSum(entries: Pick<Entry, "amount" | "currency">[], c: Conv) {
  const { value, approx } = sumIn(entries, c);
  return (approx ? "~" : "") + fmtMoney(value, c.to);
}

export const rateNote = (c: Conv) =>
  `Converted at ₡${c.rate.toLocaleString("en-US")} = $1`;

export const inMonth = (date: string, month: string) => date.startsWith(month);

/** Days past due (positive) or until due (negative); null without a due date. */
export function overdueDays(due: string | null, today: string) {
  if (!due) return null;
  return Math.round(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${due}T00:00:00Z`)) / 864e5,
  );
}
