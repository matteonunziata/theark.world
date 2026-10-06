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
import { fetchCatalog } from "@/lib/farm-catalog";
import { CATEGORIES, SHOP_METHODS, type ShopMethod } from "@/lib/shop";

/** Every shop page shows the ledger one way or another. */
const refresh = () => revalidatePath("/shop", "layout");

const asMethod = (v: string | null): ShopMethod | null =>
  SHOP_METHODS.some((m) => m[0] === v) ? (v as ShopMethod) : null;

export async function saveProduct(
  _prev: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  const { supabase, staff } = await staffOrThrow("admin", "shop");
  const id = field(data, "id");

  if (data.get("intent") === "delete" && id) {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return fail(friendly(error));
    refresh();
    return ok("Product deleted");
  }

  const name = field(data, "name");
  const price = field(data, "price");
  if (!name) return fail("Enter a name.");
  if (price === null || Number(price) < 0) return fail("Enter a price.");
  const stock = Math.max(0, Number(field(data, "stock") ?? 0));
  const memberPrice = field(data, "member_price");
  const category = field(data, "category") ?? "Other";
  const trackStock = data.get("track_stock") === "on";
  const row = {
    name,
    category: CATEGORIES.includes(category) ? category : "Other",
    unit: field(data, "unit"),
    price: Number(price),
    member_price: memberPrice === null ? null : Number(memberPrice),
    low_at: Math.max(0, Number(field(data, "low_at") ?? 0)),
    description: field(data, "description"),
    track_stock: trackStock,
    image_path: field(data, "image_path"),
    // A photo from the online shop stays unless it was removed.
    ...(data.get("image_url_keep") === "1" ? {} : { image_url: null }),
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
  const delta = trackStock ? stock - current : 0;
  if (delta) {
    const { error } = await supabase.from("stock_movements").insert({
      product_id: productId!,
      type: id ? "adjusted" : "restock",
      delta,
      by_id: staff.id,
    });
    if (error) return fail(friendly(error));
  }
  refresh();
  return ok(id ? "Product saved" : `${name} added`);
}

type Line = { product_id: string; qty: number };

/** Lines from the till form: a JSON list of product ids and quantities. */
function readLines(data: FormData): Line[] | string {
  let raw: unknown;
  try {
    raw = JSON.parse(String(data.get("lines") ?? "[]"));
  } catch {
    return "Add at least one product.";
  }
  if (!Array.isArray(raw) || !raw.length) return "Add at least one product.";
  const lines: Line[] = [];
  for (const l of raw) {
    const id = typeof l?.product_id === "string" ? l.product_id : "";
    const qty = Number(l?.qty);
    if (!id || !(qty > 0)) return "Every line needs a product and a quantity.";
    const same = lines.find((x) => x.product_id === id);
    if (same) same.qty += qty;
    else lines.push({ product_id: id, qty });
  }
  return lines;
}

/**
 * One sale with any number of lines. Lines share an order id, each keeps
 * the unit price it was charged at (member price for active members when
 * the product has one), and the sale notes how it was paid and for whom.
 */
export async function recordSale(
  _prev: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  const { supabase, staff } = await staffOrThrow("admin", "shop");
  const lines = readLines(data);
  if (typeof lines === "string") return fail(lines);
  const method = asMethod(field(data, "method"));
  if (!method) return fail("How was it paid?");
  const contactId = field(data, "contact_id");

  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, price, member_price, stock, track_stock, unit")
    .in(
      "id",
      lines.map((l) => l.product_id),
    );
  if (error) return fail(friendly(error));
  const byId = new Map((products ?? []).map((p) => [p.id, p]));

  let member = false;
  if (contactId && (products ?? []).some((p) => p.member_price != null)) {
    const { data } = await supabase.rpc("is_active_member", { cid: contactId });
    member = !!data;
  }

  const orderId = crypto.randomUUID();
  const rows = [];
  for (const l of lines) {
    const p = byId.get(l.product_id);
    if (!p) return fail("One of the products is no longer in the shop.");
    if (p.track_stock && Number(p.stock) < l.qty) {
      return fail(
        Number(p.stock) <= 0
          ? `${p.name} is out of stock.`
          : `Only ${Number(p.stock)} ${p.unit ?? ""} of ${p.name} in stock.`.replace("  ", " "),
      );
    }
    const unit = Number(member && p.member_price != null ? p.member_price : p.price);
    rows.push({
      product_id: p.id,
      type: "sale" as const,
      delta: -l.qty,
      by_id: staff.id,
      contact_id: contactId,
      unit_price: unit,
      amount: Math.round(unit * l.qty * 100) / 100,
      method,
      order_id: orderId,
    });
  }
  const { error: insErr } = await supabase.from("stock_movements").insert(rows);
  if (insErr) return fail(friendly(insErr));
  refresh();
  const total = rows.reduce((n, r) => n + r.amount, 0);
  return ok(
    `Sale recorded: ${rows.length} line${rows.length === 1 ? "" : "s"}, ₡${Math.round(total).toLocaleString("en-US")}`,
  );
}

/** A delivery: several products restocked at once, kept together as one order. */
export async function recordDelivery(
  _prev: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  const { supabase, staff } = await staffOrThrow("admin", "shop");
  const lines = readLines(data);
  if (typeof lines === "string") return fail(lines);
  const orderId = crypto.randomUUID();
  const { error } = await supabase.from("stock_movements").insert(
    lines.map((l) => ({
      product_id: l.product_id,
      type: "restock" as const,
      delta: l.qty,
      by_id: staff.id,
      order_id: orderId,
    })),
  );
  if (error) return fail(friendly(error));
  refresh();
  return ok(`Restocked ${lines.length} product${lines.length === 1 ? "" : "s"}`);
}

/** Quick change from a product's drawer: one line, sale or restock. */
export async function recordStock(
  productId: string,
  type: "sale" | "restock",
  qty: number,
  contactId?: string | null,
  method?: string | null,
): Promise<ActionResult> {
  const { supabase, staff } = await staffOrThrow("admin", "shop");
  if (!(qty > 0)) return fail("Enter a quantity.");
  let amount: number | null = null;
  let unit: number | null = null;
  if (type === "sale") {
    const { data: p } = await supabase
      .from("products")
      .select("stock, price, member_price, track_stock")
      .eq("id", productId)
      .single();
    if (p?.track_stock && Number(p.stock) < qty) {
      return fail(`Only ${Number(p.stock)} in stock.`);
    }
    if (p) {
      // Member price for active members, when the product has one.
      let member = false;
      if (contactId && p.member_price != null) {
        const { data } = await supabase.rpc("is_active_member", { cid: contactId });
        member = !!data;
      }
      unit = Number(member ? p.member_price : p.price);
      amount = qty * unit;
    }
  }
  const { error } = await supabase.from("stock_movements").insert({
    product_id: productId,
    type,
    delta: type === "sale" ? -qty : qty,
    by_id: staff.id,
    contact_id: type === "sale" ? (contactId ?? null) : null,
    amount,
    unit_price: unit,
    method: type === "sale" ? asMethod(method ?? null) : null,
  });
  if (error) return fail(friendly(error));
  refresh();
  return ok(type === "sale" ? "Sale recorded" : "Restocked");
}

/** Pull new products and price changes from the online shop. Stock and
 * anything edited here (name, category, photo, notes) is left alone. */
export async function syncFromWebsite(): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin", "shop");
  let rows;
  try {
    rows = await fetchCatalog();
  } catch {
    return fail("Couldn’t reach thearkfarm.shop. Try again in a minute.");
  }
  const { data: existing, error } = await supabase
    .from("products")
    .select("id, external_id, description")
    .not("external_id", "is", null);
  if (error) return fail(friendly(error));
  const byExt = new Map(existing.map((p) => [p.external_id!, p]));

  const fresh = rows.filter((r) => !byExt.has(r.external_id));
  if (fresh.length) {
    const { error } = await supabase
      .from("products")
      .insert(fresh.map((r) => ({ ...r, track_stock: false, low_at: 0 })));
    if (error) return fail(friendly(error));
  }
  let updated = 0;
  for (const r of rows) {
    const p = byExt.get(r.external_id);
    if (!p) continue;
    const { error } = await supabase
      .from("products")
      .update({
        price: r.price,
        online: r.online,
        web_url: r.web_url,
        image_url: r.image_url,
        product_group: r.product_group,
        variant: r.variant,
        ...(p.description ? {} : { description: r.description }),
      })
      .eq("id", p.id);
    if (!error) updated++;
  }
  refresh();
  return ok(
    fresh.length
      ? `${fresh.length} new from the website, ${updated} updated`
      : `Up to date with the website (${updated} products checked)`,
  );
}
