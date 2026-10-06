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
