import type { Metadata } from "next";
import { addMonths, monthKey } from "@/lib/dates";
import { loadFinance } from "./data";
import { OverviewView } from "./overview-view";

export const metadata: Metadata = { title: "Finance" };

export default async function FinancePage({ searchParams }: PageProps<"/finance">) {
  const { supabase, entries, lines, currency, conv, today } = await loadFinance();
  const { m } = await searchParams;
  const k = typeof m === "string" && /^\d{4}-\d{2}$/.test(m) ? m : monthKey(today);
  const [{ data: months }, { data: tix }] = await Promise.all([
    supabase.from("finance_months").select("month, cash, cash_date, notes"),
    supabase.rpc("ticket_sales_for_month", { p_month: `${k}-01` }),
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
      currency={currency}
      conv={conv}
      today={today}
    />
  );
}
