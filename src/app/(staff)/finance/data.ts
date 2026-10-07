import { requireStaff } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { getFinanceView } from "@/lib/finance-currency";

/** Everything the finance pages share. RLS limits all of it to admins. */
export async function loadFinance() {
  const { supabase } = await requireStaff("finance");
  const [{ data: entries }, { data: lines }, { data: org }, { conv, base }] = await Promise.all([
    supabase
      .from("finance_entries")
      .select("*, contact:contacts(id, name)")
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("business_lines").select("*").order("position"),
    supabase.rpc("public_org").maybeSingle(),
    getFinanceView(supabase),
  ]);
  return {
    supabase,
    entries: entries ?? [],
    lines: lines ?? [],
    /** The organization\u2019s own currency: what cash in bank and ticket sales are kept in. */
    currency: base,
    /** What Finance is being viewed in, and the rate. */
    conv,
    today: todayIn(org?.timezone ?? undefined),
  };
}
