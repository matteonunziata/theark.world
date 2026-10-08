"use server";

import { revalidatePath } from "next/cache";
import { friendly } from "@/lib/action-result";
import { staffOrThrow } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { chargeSavedCard, tilopayReady } from "@/lib/tilopay";

export type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  photo_path: string | null;
  tier: string | null;
  membership_status: string | null;
  discount_percent: number;
  has_card: boolean;
};

export type SaleLine = { product_id: string; qty: number };
export type Method = "tilopay_account" | "bac_card" | "sinpe" | "cash";

export type Receipt = {
  sale_id: string;
  total: number;
  subtotal: number;
  discount: number;
  discount_percent: number;
  change_due: number | null;
  lines: { name: string; qty: number; gross: number; discount: number }[];
};

export type SaleResult = { ok: true; receipt: Receipt } | { ok: false; error: string };

export async function searchCustomers(q: string): Promise<Customer[]> {
  const { supabase } = await staffOrThrow("admin", "shop");
  if (q.trim().length < 2) return [];
  const { data } = await supabase.rpc("checkout_customers", { p_q: q });
  return (data ?? []).map((c) => ({ ...c, discount_percent: Number(c.discount_percent) }));
}

/**
 * Finish a sale. The database prices the basket and writes the sale, payment
 * and stock movements in one transaction. For "Pay with account" the card is
 * charged first; if the charge fails nothing is recorded.
 */
export async function completeSale(input: {
  contactId: string | null;
  lines: SaleLine[];
  method: Method;
  reference?: string;
  cashReceived?: number;
}): Promise<SaleResult> {
  const { supabase } = await staffOrThrow("admin", "shop");
  const contact = input.contactId || null;
  let reference = input.reference?.trim() || null;

  if (input.method === "tilopay_account") {
    if (!contact) return { ok: false, error: "Choose a customer to pay with their account." };
    if (!tilopayReady()) return { ok: false, error: "Pay with account isn’t set up yet." };
    // Check stock and the total before any money moves.
    const { data: q, error: qe } = await supabase.rpc("checkout_price", {
      p_contact: contact,
      p_lines: input.lines,
    });
    if (qe) return { ok: false, error: friendly(qe) };
    const { data: token } = await supabase.rpc("checkout_card_token", { cid: contact });
    if (!token) return { ok: false, error: "This customer has no saved card." };
    const total = Number((q as { total: number }).total);
    const charge = await chargeSavedCard(token, total, crypto.randomUUID());
    if (!charge.ok) return { ok: false, error: charge.error };
    reference = charge.transactionId;
  }

  const { data, error } = await supabase.rpc("checkout_sale", {
    p_contact: contact,
    p_lines: input.lines,
    p_method: input.method,
    p_reference: reference,
    p_cash_received: input.method === "cash" ? (input.cashReceived ?? null) : null,
  });
  if (error) {
    if (input.method === "tilopay_account") {
      // The card was charged but the sale didn't save: say so, with the id to refund.
      console.error("Checkout: Tilopay charged but sale failed", reference, error);
      return {
        ok: false,
        error: `The card was charged (Tilopay ${reference}) but the sale couldn’t be saved. Don’t charge again; tell an admin to refund or record it.`,
      };
    }
    return { ok: false, error: friendly(error) };
  }
  revalidatePath("/shop", "layout");
  revalidatePath("/crm", "layout");
  const r = data as {
    sale_id: string;
    total: number;
    subtotal: number;
    discount: number;
    discount_percent: number;
    change_due: number | null;
    lines: { name: string; qty: number; gross: number; discount: number }[];
  };
  return {
    ok: true,
    receipt: {
      sale_id: r.sale_id,
      total: Number(r.total),
      subtotal: Number(r.subtotal),
      discount: Number(r.discount),
      discount_percent: Number(r.discount_percent),
      change_due: r.change_due == null ? null : Number(r.change_due),
      lines: r.lines.map((l) => ({
        name: l.name,
        qty: Number(l.qty),
        gross: Number(l.gross),
        discount: Number(l.discount),
      })),
    },
  };
}

const colones = (n: number) => `₡${Math.round(n).toLocaleString("en-US")}`;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** Email the receipt of a finished sale to its customer. */
export async function emailReceipt(saleId: string, to: string | null): Promise<{ ok: boolean; message: string }> {
  const { supabase } = await staffOrThrow("admin", "shop");
  const { data: sale } = await supabase
    .from("sales")
    .select("total, subtotal, discount, discount_percent, created_at, items:sale_items(name, quantity, unit_price, discount)")
    .eq("id", saleId)
    .maybeSingle();
  if (!sale || !to) return { ok: false, message: "This customer has no email on file." };
  const rows = sale.items
    .map(
      (i) =>
        `<tr><td style="padding:4px 0">${esc(i.name)} × ${Number(i.quantity)}</td><td align="right" style="padding:4px 0">${colones(Number(i.unit_price) * Number(i.quantity) - Number(i.discount))}</td></tr>`,
    )
    .join("");
  const disc = Number(sale.discount) > 0
    ? `<tr><td style="padding:4px 0">Member discount (${Number(sale.discount_percent)}%)</td><td align="right">−${colones(Number(sale.discount))}</td></tr>`
    : "";
  const sent = await sendEmail({
    to,
    subject: "Your receipt from The ARK farm shop",
    parts: {
      eyebrow: "Receipt",
      heading: colones(Number(sale.total)),
      body: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px">${rows}${disc}<tr><td style="padding:10px 0 0;font-weight:700">Total</td><td align="right" style="padding:10px 0 0;font-weight:700">${colones(Number(sale.total))}</td></tr></table>`,
      footnote: "Thank you for shopping at The ARK farm shop.",
    },
    text: `Receipt from The ARK farm shop\n\n${sale.items.map((i) => `${i.name} × ${Number(i.quantity)}`).join("\n")}\n\nTotal ${colones(Number(sale.total))}`,
  });
  return sent
    ? { ok: true, message: `Receipt sent to ${to}` }
    : { ok: false, message: "Email isn’t set up, or it couldn’t be sent." };
}
