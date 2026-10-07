import { Icon } from "@/components/icons";
import { Tabs } from "@/components/tabs";
import { isBudgetAdmin, requireStaff } from "@/lib/auth";
import { rateNote } from "@/lib/finance";
import { getFinanceView } from "@/lib/finance-currency";
import { CurrencyToggle } from "./currency-toggle";

export default async function FinanceLayout({ children }: LayoutProps<"/finance">) {
  const { staff, supabase } = await requireStaff("finance");
  const ledger = staff.role === "admin";
  const budgetAdmin = isBudgetAdmin(staff);
  if (!ledger && !staff.finance_role) {
    return (
      <div className="page">
        <div className="lock">
          <Icon name="lock" />
          <h2>Finance is restricted</h2>
          <p>Only admins and sector managers can open Finance.</p>
        </div>
      </div>
    );
  }
  const { conv } = await getFinanceView(supabase);

  // What an admin has waiting: budgets to approve and payments to make.
  let waiting = 0;
  if (budgetAdmin) {
    const [{ count: b }, { count: r }] = await Promise.all([
      supabase.from("budgets").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("payment_requests").select("id", { count: "exact", head: true }).eq("status", "requested"),
    ]);
    waiting = (b ?? 0) + (r ?? 0);
  }

  const tabs = [
    ...(ledger
      ? [
          { href: "/finance", label: "Overview" },
          { href: "/finance/transactions", label: "Transactions" },
          { href: "/finance/documents", label: "Receipts & invoices" },
          { href: "/finance/payables", label: "Payables" },
          { href: "/finance/receivables", label: "Receivables" },
        ]
      : []),
    { href: "/finance/budgets", label: waiting ? `Budgets (${waiting})` : "Budgets" },
    ...(ledger ? [] : [{ href: "/finance/payables", label: "Payables" }]),
    { href: "/finance/providers", label: "Providers" },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Finance</h1>
          <p className="lede">
            {ledger
              ? "Revenue by business line, every transaction with its receipt, what’s owed in either direction, and sector budgets and payments."
              : "Budgets, payments and providers for your sector."}
          </p>
        </div>
        <div className="bp-head-tools">
          <CurrencyToggle value={conv.to} note={rateNote(conv)} />
        </div>
      </div>
      <Tabs label="Finance sections" items={tabs} />
      {children}
    </div>
  );
}
