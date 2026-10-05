import type { Tables } from "@/lib/database.types";
import { fmtMoney } from "@/lib/shop";

export type Entry = Tables<"finance_entries"> & {
  contact?: { id: string; name: string } | null;
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

export const inMonth = (date: string, month: string) => date.startsWith(month);

/** Days past due (positive) or until due (negative); null without a due date. */
export function overdueDays(due: string | null, today: string) {
  if (!due) return null;
  return Math.round(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${due}T00:00:00Z`)) / 864e5,
  );
}
