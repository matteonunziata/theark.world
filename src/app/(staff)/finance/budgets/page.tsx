import type { Metadata } from "next";
import { budgetStats, type Budget, type LineTotals } from "@/lib/budgets";
import { loadBudgetsContext } from "./data";
import { type Card, BudgetList } from "./budget-list";
import { HowItWorks } from "./how-it-works";

export const metadata: Metadata = { title: "Budgets" };

export default async function BudgetsPage() {
  const { supabase, staff, isAdmin, conv, divisions } = await loadBudgetsContext();
  const [{ data: budgets }, { data: lines }, { data: totals }] = await Promise.all([
    supabase
      .from("budgets")
      .select("*, division:divisions(id, name, color)")
      .order("created_at", { ascending: false }),
    supabase.from("budget_lines").select("id, budget_id, planned_crc"),
    supabase.from("budget_line_totals").select("*"),
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
