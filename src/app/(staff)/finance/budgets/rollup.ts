import { budgetStats, type LineTotals } from "@/lib/budgets";
import type { createClient } from "@/lib/supabase/server";

export type SectorRollup = {
  id: string;
  name: string;
  color: string;
  budgets: number;
  planned: number;
  spent: number;
};

/** Approved budgets rolled up by sector: planned vs spent (or committed), in colones. */
export async function loadSectorRollup(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<SectorRollup[]> {
  const [{ data: budgets }, { data: lines }, { data: totals }, { data: divisions }] =
    await Promise.all([
      supabase.from("budgets").select("id, division_id, type").eq("status", "approved"),
      supabase.from("budget_lines").select("id, budget_id, planned_crc"),
      supabase.from("budget_line_totals").select("*"),
      supabase.from("divisions").select("id, name, color").order("name"),
    ]);
  const rows: SectorRollup[] = [];
  for (const d of divisions ?? []) {
    const mine = (budgets ?? []).filter((b) => b.division_id === d.id);
    if (!mine.length) continue;
    let planned = 0;
    let spent = 0;
    for (const b of mine) {
      const s = budgetStats(
        b.type,
        (lines ?? []).filter((l) => l.budget_id === b.id),
        ((totals ?? []) as LineTotals[]).filter((t) => t.budget_id === b.id),
      );
      planned += s.planned;
      spent += s.spent;
    }
    rows.push({ ...d, budgets: mine.length, planned, spent });
  }
  return rows;
}
