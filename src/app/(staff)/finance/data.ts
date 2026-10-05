import { requireStaff } from "@/lib/auth";
import { todayIn } from "@/lib/dates";

/** Everything the finance pages share. RLS limits all of it to admins. */
export async function loadFinance() {
  const { supabase } = await requireStaff("finance");
  const [{ data: entries }, { data: lines }, { data: org }] = await Promise.all([
    supabase
      .from("finance_entries")
      .select("*, contact:contacts(id, name)")
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("business_lines").select("*").order("position"),
    supabase.rpc("public_org").maybeSingle(),
  ]);
  return {
    supabase,
    entries: entries ?? [],
    lines: lines ?? [],
    currency: org?.currency ?? "CRC",
    today: todayIn(org?.timezone ?? undefined),
  };
}
