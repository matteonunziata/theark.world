import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { ShopView } from "./shop-view";

export const metadata: Metadata = { title: "Products & stock" };

export default async function ProductsPage({ searchParams }: PageProps<"/shop/products">) {
  const [{ supabase, staff }, sp] = await Promise.all([requireStaff("shop"), searchParams]);
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
    <ShopView
      products={products ?? []}
      moves={moves ?? []}
      currency={org?.currency ?? "CRC"}
      canEdit={staff.role === "admin" || staff.role === "shop"}
      initialLow={sp.low === "1"}
    />
  );
}
