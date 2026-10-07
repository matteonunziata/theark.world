import { requireBudgets } from "@/lib/auth";
import { getFinanceView } from "@/lib/finance-currency";

/** What every budget page shares. RLS limits all of it to the person's own sector (admins see all). */
export async function loadBudgetsContext() {
  const v = await requireBudgets();
  const [{ conv }, { data: divisions }] = await Promise.all([
    getFinanceView(v.supabase),
    v.supabase.from("divisions").select("id, name, color").order("name"),
  ]);
  return { ...v, conv, divisions: divisions ?? [] };
}
