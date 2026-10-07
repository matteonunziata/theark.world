import type { Metadata } from "next";
import { budgetStats, type Budget, type LineTotals } from "@/lib/budgets";
import { todayIn } from "@/lib/dates";
import { loadBudgetsContext } from "./data";
import { QueueView } from "./queue-view";
import { type Card, BudgetList } from "./budget-list";
import { HowItWorks } from "./how-it-works";

export const metadata: Metadata = { title: "Budgets" };

export default async function BudgetsPage() {
  const { supabase, staff, isAdmin, conv, divisions } = await loadBudgetsContext();
  const [{ data: budgets }, { data: lines }, { data: totals }, pending, requests, accounts] = await Promise.all([
    supabase
      .from("budgets")
      .select("*, division:divisions(id, name, color)")
      .order("created_at", { ascending: false }),
    supabase.from("budget_lines").select("id, budget_id, category, planned_crc"),
    supabase.from("budget_line_totals").select("*"),
    // Approvals: only the top admin / owners see and act on these.
    isAdmin
      ? supabase.from("budgets").select("*").eq("status", "pending").order("submitted_at")
      : null,
    isAdmin
      ? supabase
          .from("payment_requests")
          .select("*, budget:budgets(id, name, division_id), provider:providers(name), line:budget_lines(category, planned_crc)")
          .eq("status", "requested")
          .order("due_date", { ascending: true, nullsFirst: false })
      : null,
    isAdmin
      ? supabase.from("provider_bank_accounts").select("id, provider_id, bank, account_holder, account_number, currency")
      : null,
  ]);

  const cards: Card[] = (budgets ?? []).map((b) => {
    const ls = (lines ?? []).filter((l) => l.budget_id === b.id);
    const ts = (totals ?? []).filter((t) => t.budget_id === b.id) as LineTotals[];
    const s = budgetStats(b.type, ls, ts);
    return { budget: b as Budget, planned: s.planned, spent: s.spent, lineCount: ls.length };
  });

  return (
    <>
      <HowItWorks isAdmin={isAdmin} />
      {isAdmin && (
        <QueueView
          budgets={pending?.data ?? []}
          lines={lines ?? []}
          totals={(totals ?? []) as LineTotals[]}
          requests={requests?.data ?? []}
          accounts={accounts?.data ?? []}
          divisions={divisions}
          conv={conv}
          today={todayIn()}
        />
      )}
      <BudgetList
        cards={cards}
        divisions={divisions}
        myDivision={staff.division_id}
        isAdmin={isAdmin}
        conv={conv}
      />
    </>
  );
}
