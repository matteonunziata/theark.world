import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { tilopayReady } from "@/lib/tilopay";
import { CheckoutView } from "./checkout-view";

export const metadata: Metadata = { title: "Farm shop checkout" };

export default async function CheckoutPage() {
  const { supabase, staff } = await requireStaff("shop");
  // Checkout is for the shop team and admins; division leads see the rest of the shop.
  if (staff.role !== "admin" && staff.role !== "shop") redirect("/shop");
  const [{ data: products }, { data: org }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, category, unit, price, stock, track_stock, image_path, image_url")
      .eq("active", true)
      .order("name"),
    supabase.from("org_settings").select("sinpe_number").eq("id", true).maybeSingle(),
  ]);
  return (
    <CheckoutView
      products={(products ?? []).map((p) => ({
        ...p,
        price: Number(p.price),
        stock: Number(p.stock),
      }))}
      sinpe={org?.sinpe_number ?? null}
      tilopay={tilopayReady()}
    />
  );
}
