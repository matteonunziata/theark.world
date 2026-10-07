import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { todayIn } from "@/lib/dates";
import type { Budget, LineTotals } from "@/lib/budgets";
import { loadBudgetsContext } from "../data";
import { BudgetDetail } from "./budget-detail";

export const metadata: Metadata = { title: "Budget" };

export default async function BudgetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, staff, isAdmin, conv, divisions } = await loadBudgetsContext();
  const { data: budget } = await supabase
    .from("budgets")
    .select("*, division:divisions(id, name, color)")
    .eq("id", id)
    .maybeSingle();
  if (!budget) notFound();

  const [lines, totals, movements, requests, events, providers, accounts, approver] =
    await Promise.all([
      supabase.from("budget_lines").select("*").eq("budget_id", id).order("position").order("created_at"),
      supabase.from("budget_line_totals").select("*").eq("budget_id", id),
      supabase.from("budget_movements").select("*").eq("budget_id", id).order("movement_date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("payment_requests").select("*").eq("budget_id", id).order("requested_at", { ascending: false }),
      supabase.from("budget_events").select("*").eq("budget_id", id).order("created_at", { ascending: false }),
      supabase.from("providers").select("id, name").order("name"),
      supabase.from("provider_bank_accounts").select("id, provider_id, bank, account_holder, account_number, currency"),
      budget.approved_by
        ? supabase.from("team_members").select("name").eq("id", budget.approved_by).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  return (
    <BudgetDetail
      budget={budget as Budget}
      lines={lines.data ?? []}
      totals={(totals.data ?? []) as LineTotals[]}
      movements={movements.data ?? []}
      requests={requests.data ?? []}
      events={events.data ?? []}
      providers={providers.data ?? []}
      accounts={accounts.data ?? []}
      approver={approver.data?.name ?? null}
      divisions={divisions}
      isAdmin={isAdmin}
      canWork={isAdmin || staff.division_id === budget.division_id}
      conv={conv}
      today={todayIn()}
    />
  );
}
