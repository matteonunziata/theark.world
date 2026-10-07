import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { loadBudgetsContext } from "../budgets/data";
import { loadFinance } from "../data";
import { EntryList } from "../entry-list";
import { PaymentsList } from "../payments/payments-list";

const byDue = (a: { due_date: string | null }, b: { due_date: string | null }) =>
  (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
export const metadata: Metadata = { title: "Payables" };

export default async function Page() {
  const { staff } = await requireStaff("finance");
  const ledger = staff.role === "admin";
  const { supabase, isAdmin, conv, divisions } = await loadBudgetsContext();
  const { data } = await supabase
    .from("payment_requests")
    .select(
      "*, budget:budgets(id, name, division_id), provider:providers(name), line:budget_lines(category)",
    )
    .eq("status", "paid")
    .order("paid_at", { ascending: false });
  const paid = (
    <>
      <h2 style={{ margin: "32px 0 14px" }}>Paid</h2>
      <PaymentsList payments={data ?? []} divisions={divisions} isAdmin={isAdmin} conv={conv} />
    </>
  );
  if (!ledger) return paid;

  const { entries, lines, today } = await loadFinance();
  return (
    <>
      <EntryList
        entries={entries
          .filter((e) => e.kind === "expense" && e.status === "unpaid")
          .sort(byDue)}
        lines={lines}
        conv={conv}
        today={today}
        mode="payables"
      />
      {paid}
    </>
  );
}
