import type { Metadata } from "next";
import { requireBudgetAdmin } from "@/lib/auth";
import { getFinanceView } from "@/lib/finance-currency";
import { todayIn } from "@/lib/dates";
import type { LineTotals } from "@/lib/budgets";
import { QueueView } from "./queue-view";

export const metadata: Metadata = { title: "Approvals" };

export default async function QueuePage() {
  const { supabase } = await requireBudgetAdmin();
  const [{ conv }, budgets, lines, totals, requests, accounts, divisions] = await Promise.all([
    getFinanceView(supabase),
    supabase.from("budgets").select("*").eq("status", "pending").order("submitted_at"),
    supabase.from("budget_lines").select("id, budget_id, category, planned_crc"),
    supabase.from("budget_line_totals").select("*"),
    supabase
      .from("payment_requests")
      .select("*, budget:budgets(id, name, division_id), provider:providers(name), line:budget_lines(category, planned_crc)")
      .eq("status", "requested")
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("provider_bank_accounts").select("id, provider_id, bank, account_holder, account_number, currency"),
    supabase.from("divisions").select("id, name, color").order("name"),
  ]);
  return (
    <QueueView
      budgets={budgets.data ?? []}
      lines={lines.data ?? []}
      totals={(totals.data ?? []) as LineTotals[]}
      requests={requests.data ?? []}
      accounts={accounts.data ?? []}
      divisions={divisions.data ?? []}
      conv={conv}
      today={todayIn()}
    />
  );
}
