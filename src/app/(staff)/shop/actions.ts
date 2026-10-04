"use server";

import { revalidatePath } from "next/cache";
import {
  type ActionResult,
  fail,
  field,
  friendly,
  ok,
} from "@/lib/action-result";
import { staffOrThrow } from "@/lib/auth";
import { CATEGORIES } from "@/lib/shop";


export async function saveProduct(
  _prev: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  const { supabase, staff } = await staffOrThrow("admin", "shop");
  const id = field(data, "id");

  if (data.get("intent") === "delete" && id) {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return fail(friendly(error));
    revalidatePath("/shop");
    return ok("Product deleted");
  }

  const name = field(data, "name");
  const price = field(data, "price");
  if (!name) return fail("Enter a name.");
  if (price === null || Number(price) < 0) return fail("Enter a price.");
  const stock = Math.max(0, Number(field(data, "stock") ?? 0));
  const memberPrice = field(data, "member_price");
  const category = field(data, "category") ?? "Other";
  const row = {
    name,
    category: CATEGORIES.includes(category) ? category : "Other",
    unit: field(data, "unit"),
    price: Number(price),
    member_price: memberPrice === null ? null : Number(memberPrice),
    low_at: Math.max(0, Number(field(data, "low_at") ?? 0)),
    description: field(data, "description"),
  };

  // Stock only changes through the ledger so every change is recorded.
  let productId = id;
  let current = 0;
  if (id) {
    const { data: p, error } = await supabase
      .from("products")
      .update(row)
      .eq("id", id)
      .select("stock")
      .single();
    if (error) return fail(friendly(error));
    current = Number(p.stock);
  } else {
    const { data: p, error } = await supabase
      .from("products")
      .insert(row)
      .select("id")
      .single();
    if (error) return fail(friendly(error));
    productId = p.id;
  }
  const delta = stock - current;
  if (delta) {
    const { error } = await supabase.from("stock_movements").insert({
      product_id: productId!,
      type: id ? "adjusted" : "restock",
      delta,
      by_id: staff.id,
    });
    if (error) return fail(friendly(error));
  }
  revalidatePath("/shop");
  return ok(id ? "Product saved" : `${name} added`);
}

export async function recordStock(
  productId: string,
  type: "sale" | "restock",
  qty: number,
): Promise<ActionResult> {
  const { supabase, staff } = await staffOrThrow("admin", "shop");
  if (!(qty > 0)) return fail("Enter a quantity.");
  if (type === "sale") {
    const { data: p } = await supabase
      .from("products")
      .select("stock")
      .eq("id", productId)
      .single();
    if (p && Number(p.stock) < qty) {
      return fail(`Only ${Number(p.stock)} in stock.`);
    }
  }
  const { error } = await supabase.from("stock_movements").insert({
    product_id: productId,
    type,
    delta: type === "sale" ? -qty : qty,
    by_id: staff.id,
  });
  if (error) return fail(friendly(error));
  revalidatePath("/shop");
  return ok(type === "sale" ? "Sale recorded" : "Restocked");
}
