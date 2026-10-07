import type { Metadata } from "next";
import { addMonths, monthKey } from "@/lib/dates";
import { loadSectorRollup } from "./budgets/rollup";
import { loadFinance } from "./data";
import { OverviewView } from "./overview-view";

export const metadata: Metadata = { title: "Finance" };

export default async function FinancePage({ searchParams }: PageProps<"/finance">) {
  const { supabase, entries, lines, currency, conv, today } = await loadFinance();
  const { m } = await searchParams;
  const k = typeof m === "string" && /^\d{4}-\d{2}$/.test(m) ? m : monthKey(today);
  const [{ data: months }, { data: tix }, sectors, pending, asked] = await Promise.all([
    supabase.from("finance_months").select("month, cash, cash_date, notes"),
    supabase.rpc("ticket_sales_for_month", { p_month: `${k}-01` }),
    loadSectorRollup(supabase),
    supabase.from("budgets").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("payment_requests").select("amount_crc").eq("status", "requested"),
  ]);
  return (
    <OverviewView
      month={k}
      prev={addMonths(k, -1)}
      next={addMonths(k, 1)}
      thisMonth={monthKey(today)}
      entries={entries}
      lines={lines}
      cash={(months ?? []).map((r) => ({ ...r, key: r.month.slice(0, 7) }))}
      ticketSales={Number(tix ?? 0)}
      sectors={sectors}
      attention={{
        pendingBudgets: pending.count ?? 0,
        requests: asked.data?.length ?? 0,
        requestsCrc: (asked.data ?? []).reduce((n, r) => n + Number(r.amount_crc), 0),
      }}
      currency={currency}
      conv={conv}
      today={today}
    />
  );
}
