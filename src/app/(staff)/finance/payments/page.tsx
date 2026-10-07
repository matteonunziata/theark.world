import type { Metadata } from "next";
import { loadBudgetsContext } from "../budgets/data";
import { PaymentsList } from "./payments-list";

export const metadata: Metadata = { title: "Payments made" };

export default async function PaymentsPage() {
  const { supabase, isAdmin, conv, divisions } = await loadBudgetsContext();
  const { data } = await supabase
    .from("payment_requests")
    .select(
      "*, budget:budgets(id, name, division_id), provider:providers(name), line:budget_lines(category)",
    )
    .eq("status", "paid")
    .order("paid_at", { ascending: false });
  return <PaymentsList payments={data ?? []} divisions={divisions} isAdmin={isAdmin} conv={conv} />;
}
