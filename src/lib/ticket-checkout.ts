import "server-only";
import { fmtDate } from "@/lib/dates";
import { type CheckoutInput, findStripePrice } from "@/lib/stripe";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

export type TicketCheckout =
  | { ok: true; input: CheckoutInput; amount: number; currency: string; summary: string; held: boolean }
  | { ok: false; reason: "gone" | "paid" | "lapsed" | "outside"; link: string | null };

/**
 * What to charge for a booked ticket, found from its own token (the one in its QR code).
 * Used by the hosted Stripe page and by the payment form inside the event page, so both
 * charge the same amount. A booking with several tickets is charged as one order at the
 * prices it was booked at. A single meal ticket can use the Stripe product with its name
 * (found once and remembered on the ticket type).
 */
export async function ticketCheckout(admin: Admin, token: string): Promise<TicketCheckout> {
  const { data: r } = await admin
    .from("registrations")
    .select(
      "id, name, email, paid, status, hold_until, session_date, contact_id, order_id, offering:offerings(title, status), ticket:ticket_types(id, name, price, currency, payment_link, pay_first, stripe_price_id), items:registration_items(qty, unit_price, currency, ticket:ticket_types(name))",
    )
    .eq("qr_token", token)
    .maybeSingle();
  if (!r || !r.ticket || r.offering?.status !== "published") return { ok: false, reason: "gone", link: null };
  // Booked as part of a cart: one payment covers every booking in it.
  if (r.order_id) return orderCheckout(admin, r.order_id, `/t/${token}`);
  if (r.paid) return { ok: false, reason: "paid", link: null };
  // A hold that lapsed can't be paid; the ticket page says to book again.
  if (r.status === "held" && r.hold_until && new Date(r.hold_until) <= new Date()) {
    return { ok: false, reason: "lapsed", link: null };
  }

  let priceId = r.ticket.stripe_price_id;
  let amount = Number(r.ticket.price);
  let currency = r.ticket.currency;
  // More than one ticket, or an add-on: charge the whole order at the prices it was booked at.
  const items = r.items ?? [];
  const order = items.length > 1 || (items.length === 1 && items[0].qty > 1);
  let what = r.ticket.name;
  if (order && new Set(items.map((i) => i.currency)).size === 1) {
    priceId = null;
    amount = items.reduce((n, i) => n + Number(i.unit_price) * i.qty, 0);
    currency = items[0].currency;
    what = items.map((i) => `${i.qty} × ${i.ticket?.name ?? "Ticket"}`).join(", ");
  }
  if (!order && !priceId && !(amount > 0)) {
    const found = await findStripePrice(r.ticket.name).catch(() => null);
    if (found) {
      priceId = found.priceId;
      amount = found.amount;
      currency = found.currency;
      await admin
        .from("ticket_types")
        .update({ stripe_price_id: found.priceId, price: found.amount, currency: found.currency })
        .eq("id", r.ticket.id);
    }
  }
  if (!priceId && !(amount > 0)) return { ok: false, reason: "outside", link: r.ticket.payment_link };

  const title = r.offering?.title ?? "Ticket";
  const day = fmtDate(r.session_date, { weekday: "short", month: "short", day: "numeric" });
  return {
    ok: true,
    amount,
    currency,
    summary: what,
    held: r.status === "held",
    input: {
      kind: "ticket",
      title: `${title}, ${day}`,
      description: what,
      priceId,
      amount,
      currency,
      email: r.email,
      meta: {
        registration_id: r.id,
        token,
        name: r.name,
        email: r.email,
        contact_id: r.contact_id,
        held: r.status === "held" ? "1" : null,
        description: `${title} (${what}), ${r.session_date}`,
      },
      cancelPath: `/t/${token}`,
    },
  };
}

/**
 * What to charge for a cart of bookings (several meals, on one or more days) made in one
 * checkout. One payment settles them all; the prices are the ones each was booked at.
 */
export async function orderCheckout(admin: Admin, orderId: string, cancelPath = "/"): Promise<TicketCheckout> {
  const { data: regs } = await admin
    .from("registrations")
    .select(
      "id, name, email, paid, status, hold_until, session_date, contact_id, offering:offerings(title, status), items:registration_items(qty, unit_price, currency, ticket:ticket_types(name))",
    )
    .eq("order_id", orderId)
    .order("session_date");
  const rows = regs ?? [];
  if (rows.length === 0 || rows.some((r) => r.offering?.status !== "published")) return { ok: false, reason: "gone", link: null };
  if (rows.some((r) => r.paid)) return { ok: false, reason: "paid", link: null };
  const now = new Date();
  if (rows.some((r) => r.status === "held" && r.hold_until && new Date(r.hold_until) <= now)) {
    return { ok: false, reason: "lapsed", link: null };
  }
  const items = rows.flatMap((r) => r.items ?? []);
  if (new Set(items.map((i) => i.currency)).size !== 1) return { ok: false, reason: "outside", link: null };
  const amount = items.reduce((n, i) => n + Number(i.unit_price) * i.qty, 0);
  if (!(amount > 0)) return { ok: false, reason: "outside", link: null };
  const currency = items[0].currency;
  const what = rows
    .map((r) => {
      const day = fmtDate(r.session_date, { weekday: "short", month: "short", day: "numeric" });
      const n = (r.items ?? []).reduce((a, i) => a + i.qty, 0);
      return `${n} × ${r.offering?.title ?? "Meal"}, ${day}`;
    })
    .join("; ");
  const first = rows[0];
  return {
    ok: true,
    amount,
    currency,
    summary: what,
    held: rows.some((r) => r.status === "held"),
    input: {
      kind: "ticket",
      title: rows.length === 1 ? what : `${rows.length} bookings at The ARK`,
      description: what,
      amount,
      currency,
      email: first.email,
      meta: {
        order_id: orderId,
        name: first.name,
        email: first.email,
        contact_id: first.contact_id,
        held: rows.some((r) => r.status === "held") ? "1" : null,
        description: what,
      },
      cancelPath,
    },
  };
}
