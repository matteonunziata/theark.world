import { Icon } from "@/components/icons";
import { Tabs } from "@/components/tabs";
import { requireStaff } from "@/lib/auth";

export default async function FinanceLayout({ children }: LayoutProps<"/finance">) {
  const { staff } = await requireStaff("finance");
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
