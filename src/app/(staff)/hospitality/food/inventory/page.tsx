import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { FoodHead } from "../food-head";
import { InventoryView } from "./inventory-view";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryPage() {
  const { supabase } = await requireStaff("hospitality");
  const { data } = await supabase.from("inventory_items").select("*").order("category").order("name");
  return (
    <div className="page">
      <FoodHead />
      <InventoryView items={data ?? []} />
    </div>
  );
}
