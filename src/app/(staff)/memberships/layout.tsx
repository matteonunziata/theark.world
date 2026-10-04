import Link from "next/link";
import { Tabs } from "@/components/tabs";
import { requireStaff } from "@/lib/auth";

export default async function MembershipsLayout({ children }: LayoutProps<"/memberships">) {
  await requireStaff("memberships");
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Memberships</h1>
          <p className="lede">
            Who’s a member, what each tier costs, and the discounts we offer.
          </p>
        </div>
        <div className="head-actions">
          <Link className="btn" href="/crm/people">Manage in CRM</Link>
          <Link className="btn primary" href="/portal" target="_blank">
            Open members portal
          </Link>
        </div>
      </div>
      <Tabs
        label="Memberships sections"
        items={[
          { href: "/memberships", label: "Members" },
          { href: "/memberships/tiers", label: "Tiers & pricing" },
        ]}
      />
      {children}
    </div>
  );
}
