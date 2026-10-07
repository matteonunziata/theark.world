import { Icon } from "@/components/icons";
import { Tabs } from "@/components/tabs";
import { requireStaff } from "@/lib/auth";
import { rateNote } from "@/lib/finance";
import { getFinanceView } from "@/lib/finance-currency";
import { CurrencyToggle } from "./currency-toggle";

export default async function FinanceLayout({ children }: LayoutProps<"/finance">) {
  const { staff, supabase } = await requireStaff("finance");
  if (staff.role !== "admin") {
    return (
      <div className="page">
        <div className="lock">
          <Icon name="lock" />
          <h2>Finance is restricted</h2>
          <p>Only admins can see financial figures.</p>
        </div>
      </div>
    );
  }
  const { conv } = await getFinanceView(supabase);
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Finance</h1>
          <p className="lede">
            Revenue by business line, every transaction with its receipt, and
            what’s owed in either direction. Admins only.
          </p>
        </div>
        <CurrencyToggle value={conv.to} note={rateNote(conv)} />
      </div>
      <Tabs
        label="Finance sections"
        items={[
          { href: "/finance", label: "Overview" },
          { href: "/finance/transactions", label: "Transactions" },
          { href: "/finance/documents", label: "Receipts & invoices" },
          { href: "/finance/payables", label: "Payables" },
          { href: "/finance/receivables", label: "Receivables" },
        ]}
      />
      {children}
    </div>
  );
}
