import { Tabs } from "@/components/tabs";
import { requireStaff } from "@/lib/auth";

export default async function ShopLayout({ children }: LayoutProps<"/shop">) {
  await requireStaff("shop");
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Farm shop</h1>
          <p className="lede">
            What’s selling, what it brings in, and what’s running low. Sales go
            through the till here; the catalog follows thearkfarm.shop.
          </p>
        </div>
      </div>
      <Tabs
        label="Farm shop sections"
        items={[
          { href: "/shop", label: "Overview" },
          { href: "/shop/sales", label: "Sales" },
          { href: "/shop/products", label: "Products & stock" },
        ]}
      />
      {children}
    </div>
  );
}
