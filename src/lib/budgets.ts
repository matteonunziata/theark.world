import type { Tables } from "@/lib/database.types";
import { type Conv, convert } from "@/lib/finance";

export type Budget = Tables<"budgets"> & {
  division?: { id: string; name: string; color: string } | null;
};
export type BudgetLine = Tables<"budget_lines">;
export type LineTotals = {
  line_id: string | null;
  budget_id: string | null;
  movements_crc: number | null;
  paid_crc: number | null;
  requested_crc: number | null;
};

export const BUDGET_TYPES = [
  ["monthly", "Monthly"],
  ["project", "Project"],
] as const;

export const BUDGET_STATUS = [
  ["draft", "Draft"],
  ["pending", "Pending approval"],
  ["approved", "Approved"],
  ["rejected", "Rejected"],
  ["closed", "Closed"],
] as const;

export const typeName = (k: string) =>
  BUDGET_TYPES.find((t) => t[0] === k)?.[1] ?? k;
export const statusName = (k: string) =>
  BUDGET_STATUS.find((t) => t[0] === k)?.[1] ?? k;

/** Class for the little status pill. */
export const statusTone = (k: string) =>
  k === "approved" ? "ok" : k === "rejected" ? "out" : k === "pending" ? "low" : "";

export const REQUEST_STATUS = {
  requested: "Requested",
  paid: "Paid",
  rejected: "Rejected",
} as const;

export const FILE_ACCEPT = "image/*,application/pdf";

/** What a line has used so far, in colones. Monthly: expenses. Project: paid plus asked for. */
export function used(type: string, t: LineTotals | undefined) {
  if (!t) return 0;
  return type === "monthly"
    ? Number(t.movements_crc ?? 0)
    : Number(t.paid_crc ?? 0) + Number(t.requested_crc ?? 0);
}

export function budgetStats(
  type: string,
  lines: Pick<BudgetLine, "id" | "planned_crc">[],
  totals: LineTotals[],
) {
  const byLine = new Map(totals.map((t) => [t.line_id, t]));
  const planned = lines.reduce((s, l) => s + Number(l.planned_crc), 0);
  const spent = lines.reduce((s, l) => s + used(type, byLine.get(l.id)), 0);
  return {
    planned,
    spent,
    remaining: planned - spent,
    pct: planned > 0 ? Math.round((spent / planned) * 100) : spent > 0 ? 100 : 0,
  };
}

/** Colones shown in whichever currency Finance is being viewed in. */
export const show = (crc: number, c: Conv) => convert(crc, "CRC", c);

export function periodLabel(b: Pick<Budget, "type" | "period_month" | "start_date" | "end_date">) {
  const d = (s: string) =>
    new Date(`${s}T12:00:00Z`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  if (b.type === "monthly" && b.period_month) {
    return new Date(`${b.period_month}T12:00:00Z`).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  return b.start_date && b.end_date ? `${d(b.start_date)} – ${d(b.end_date)}` : "";
}

/** Does this budget's period touch the month "YYYY-MM"? */
export function touchesMonth(
  b: Pick<Budget, "type" | "period_month" | "start_date" | "end_date">,
  month: string,
) {
  if (b.type === "monthly") return (b.period_month ?? "").startsWith(month);
  return (b.start_date ?? "") <= `${month}-31` && (b.end_date ?? "") >= `${month}-01`;
}

/** A timestamp as people in Costa Rica read it. */
export const fmtStamp = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Costa_Rica",
  });

export const maskAccount = (n: string) =>
  n.length > 6 ? `…${n.slice(-4)}` : n;
