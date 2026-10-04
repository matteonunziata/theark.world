import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { ShopView } from "./shop-view";

export const metadata: Metadata = { title: "Farm shop" };

export default async function ShopPage() {
  const { supabase, staff } = await requireStaff("shop");
  const [{ data: products }, { data: moves }, { data: org }] = await Promise.all([
    supabase.from("products").select("*").eq("active", true).order("name"),
    supabase
      .from("stock_movements")
      .select("id, product_id, type, delta, created_at")
      .order("created_at", { ascending: false })
      .limit(400),
    supabase.rpc("public_org").maybeSingle(),
  ]);
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Farm shop</h1>
          <p className="lede">What’s on the shelf, what it costs, and what’s running low.</p>
        </div>
      </div>
      <ShopView
        products={products ?? []}
        moves={moves ?? []}
        currency={org?.currency ?? "CRC"}
        canEdit={staff.role === "admin" || staff.role === "shop"}
      />
    </div>
  );
}
