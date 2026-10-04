import type { Metadata } from "next";
import { Icon } from "@/components/icons";
import { requireStaff } from "@/lib/auth";
import { addMonths, monthKey, todayIn } from "@/lib/dates";
import { FinanceView } from "./finance-view";

export const metadata: Metadata = { title: "Finance" };

export default async function FinancePage({ searchParams }: PageProps<"/finance">) {
  const { supabase, staff } = await requireStaff("finance");
  if (staff.role !== "admin") {
    return (
      <div className="page">
        <div className="lock">
          <Icon name="lock" />
          <h2>Finance is restricted</h2>
          <p>Only admins can see financial figures.</p>
        </div>
      </div>
    );
  }
  const { m } = await searchParams;
  const k = typeof m === "string" && /^\d{4}-\d{2}$/.test(m) ? m : monthKey(todayIn());
  const [{ data: months }, { data: tix }, { data: org }] = await Promise.all([
    supabase.from("finance_months").select("*").order("month", { ascending: false }),
    supabase.rpc("ticket_sales_for_month", { p_month: `${k}-01` }),
    supabase.rpc("public_org").maybeSingle(),
  ]);
  return (
    <div className="page">
      <FinanceView
        month={k}
        months={(months ?? []).map((r) => ({ ...r, key: r.month.slice(0, 7) }))}
        ticketSales={Number(tix ?? 0)}
        currency={org?.currency ?? "CRC"}
        prev={addMonths(k, -1)}
        next={addMonths(k, 1)}
        thisMonth={monthKey(todayIn())}
      />
    </div>
  );
}
