import type { Metadata } from "next";
import { loadBudgetsContext } from "../budgets/data";
import { ProviderList } from "./provider-list";

export const metadata: Metadata = { title: "Providers" };

export default async function ProvidersPage() {
  const { supabase, staff, isAdmin, divisions } = await loadBudgetsContext();
  const [{ data: providers }, { data: accounts }] = await Promise.all([
    supabase.from("providers").select("*").order("name"),
    supabase.from("provider_bank_accounts").select("*").order("created_at"),
  ]);
  return (
    <ProviderList
      providers={providers ?? []}
      accounts={accounts ?? []}
      divisions={divisions}
      isAdmin={isAdmin}
      myStaffId={staff.id}
    />
  );
}
