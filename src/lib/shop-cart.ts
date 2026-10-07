import { SHOP_URL } from "@/lib/farm-catalog";

// The portal shop builds a cart and hands it to Shopify's checkout as a cart
// link: /cart/{variant}:{qty},…  The member's code (member10 or member20) rides
// along, and so does their email, because the code is limited to customers
// ARK OS has tagged and Shopify finds them by email.

export type CartLine = { id: string; qty: number };

export const MAX_QTY = 20;

/** Colones rounded to a whole number, off by a percentage. */
export const memberPrice = (price: number, percent: number) =>
  percent > 0 ? Math.round(price * (1 - percent / 100)) : price;

/** Keep only well-formed lines: numeric Shopify variant ids, 1 to MAX_QTY of each, no repeats. */
export function cleanCart(lines: unknown): CartLine[] {
  if (!Array.isArray(lines)) return [];
  const seen = new Map<string, number>();
  for (const l of lines) {
    const id = l && typeof l === "object" ? String((l as CartLine).id) : "";
    const qty = Math.floor(Number((l as CartLine)?.qty));
    if (!/^\d{5,20}$/.test(id) || !Number.isFinite(qty) || qty < 1) continue;
    seen.set(id, Math.min(MAX_QTY, (seen.get(id) ?? 0) + qty));
  }
  return [...seen].map(([id, qty]) => ({ id, qty: Math.min(MAX_QTY, qty) }));
}

export function checkoutUrl(lines: CartLine[], opts: { code?: string | null; email?: string | null } = {}) {
  const items = cleanCart(lines);
  if (!items.length) return null;
  const q = new URLSearchParams();
  if (opts.code) q.set("discount", opts.code);
  if (opts.email) q.set("checkout[email]", opts.email);
  const qs = q.toString();
  return `${SHOP_URL}/cart/${items.map((l) => `${l.id}:${l.qty}`).join(",")}${qs ? `?${qs}` : ""}`;
}

export type CatalogItem = { external_id: string; name: string; product_group: string; variant: string | null; price: number };
export type OrderLine = { id: string; name: string; label: string | null; qty: number; list: number; unit: number };

/**
 * Price a basket from the catalog, never from what the browser says. Returns
 * the lines with the list price and the member price of each, the totals, or
 * a message when something in the basket isn't for sale any more.
 */
export type Priced = { error: string } | { error?: undefined; lines: OrderLine[]; subtotal: number; total: number };

export function priceOrder(catalog: CatalogItem[], lines: unknown, percent: number): Priced {
  const items = cleanCart(lines);
  if (!items.length) return { error: "Your basket is empty." };
  const byId = new Map(catalog.map((c) => [c.external_id, c]));
  const out: OrderLine[] = [];
  for (const l of items) {
    const c = byId.get(l.id);
    if (!c) return { error: "Something in your basket isn’t in the shop any more. Remove it and try again." };
    const list = Number(c.price);
    out.push({ id: l.id, name: c.product_group || c.name, label: c.variant, qty: l.qty, list, unit: memberPrice(list, percent) });
  }
  const subtotal = out.reduce((n, l) => n + l.list * l.qty, 0);
  const total = out.reduce((n, l) => n + l.unit * l.qty, 0);
  return { lines: out, subtotal, total };
}
