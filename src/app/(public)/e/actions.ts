"use server";

import { revalidatePath } from "next/cache";
import { fail, friendly } from "@/lib/action-result";
import { sendTicketEmail } from "@/lib/email";
import { notifyLater } from "@/lib/slack";
import { bookingMessage } from "@/lib/slack-format";
import { createEmbeddedCheckout, fmtAmount, fulfillCheckout, stripeEmbeddedReady, stripePublishableKey, stripeReady } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { ticketCheckout } from "@/lib/ticket-checkout";
import { createClient } from "@/lib/supabase/server";
import { loadEvent } from "./load";

export type BookingResult =
  | {
      ok: true;
      token: string;
      emailed: boolean;
      paymentLink: string | null;
      /** Pay on Stripe (ARK OS's own checkout) when the ticket has a price and no outside link. */
      payUrl: string | null;
      price: string | null;
      /** Meals: the spot is held, and confirmed only once it's paid. */
      held: boolean;
      /** "2 × Early Bird, 1 × Lunch"; null when nothing was bought. */
      summary: string | null;
      /** Pay inside the page (Stripe's form) rather than on Stripe's own page. */
      embedded: boolean;
    }
  | { ok: false; error: string };

/** Public and member booking. All checks happen in book_tickets. */
export async function bookSession(input: {
  offeringId: string;
  date: string;
  name: string;
  email: string;
  phone?: string;
  /** Tickets and how many of each; empty for members using their membership. */
  items: { ticketTypeId: string; qty: number }[];
  website?: string; // honeypot: real people leave it empty
}): Promise<BookingResult> {
  if (input.website) return { ok: false, error: "Couldn’t book. Try again." };
  const items = input.items.filter((i) => i.ticketTypeId && Number.isInteger(i.qty) && i.qty > 0);
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("book_tickets", {
      p_offering_id: input.offeringId,
      p_session_date: input.date,
      p_name: input.name,
      p_email: input.email,
      p_phone: input.phone?.trim() || undefined,
      p_items: items.map((i) => ({ ticket_type_id: i.ticketTypeId, qty: i.qty })),
    })
    .single();
  if (error || !data) {
    const r = fail(friendly(error));
    return { ok: false, error: r.error ?? "Couldn’t book. Try again." };
  }

  const { data: t } = await supabase
    .rpc("ticket_by_token", { p_token: data.qr_token })
    .single();
  const { data: types } = items.length
    ? await supabase
        .from("ticket_types")
        .select("id, name, payment_link, price, currency, pay_first, stripe_price_id")
        .in("id", items.map((i) => i.ticketTypeId))
    : { data: [] };
  const lines = items.flatMap((i) => {
    const tt = (types ?? []).find((x) => x.id === i.ticketTypeId);
    return tt ? [{ tt, qty: i.qty }] : [];
  });
  const { data: org } = await supabase.rpc("public_org").maybeSingle();

  // A pay-first ticket is a hold: the ticket and the Slack note wait for the payment.
  const held = lines.some((l) => l.tt.pay_first);
  let emailed = false;
  const to = input.email.trim().toLowerCase();
  if (t && !held) {
    // Members book with the email on their record.
    const { data: user } = await supabase.auth.getUser();
    emailed = await sendTicketEmail({
      to: user.user?.email ?? to,
      holder: t.holder,
      title: t.title,
      sessionDate: t.session_date,
      startTime: t.start_time,
      endTime: t.end_time,
      location: t.location,
      token: data.qr_token,
      orgName: org?.name ?? "The ARK",
    });
  }
  revalidatePath(`/e/${input.offeringId}`, "layout");
  // One currency is the norm; with a mix there's no single total to show.
  const currencies = new Set(lines.map((l) => l.tt.currency));
  const total = lines.reduce((n, l) => n + Number(l.tt.price) * l.qty, 0);
  const paid = total > 0;
  const price =
    paid && currencies.size === 1
      ? [...currencies][0] === "USD"
        ? `$${total.toLocaleString("en-US")}`
        : `₡${total.toLocaleString("en-US")}`
      : null;
  const summary = lines.length ? lines.map((l) => `${l.qty} × ${l.tt.name}`).join(", ") : null;
  if (t && !held) {
    const b = {
      holder: t.holder,
      title: t.title,
      date: t.session_date,
      startTime: t.start_time,
      endTime: t.end_time,
      location: t.location,
      price,
      offeringId: input.offeringId,
    };
    notifyLater("booking", (origin) => bookingMessage(b, origin));
  }
  // Stripe takes meals and priced tickets; an outside link is only the fallback while Stripe is off,
  // and only for a single ticket.
  const link = lines.length === 1 && lines[0].qty === 1 ? lines[0].tt.payment_link : null;
  const payUrl = stripeReady() && (held || (paid && !link)) ? `/pay/ticket/${data.qr_token}` : null;
  return {
    ok: true,
    token: data.qr_token,
    emailed,
    paymentLink: payUrl ? null : link,
    payUrl,
    price,
    held,
    summary,
    embedded: !!payUrl && stripeEmbeddedReady(),
  };
}

export type PaymentStart =
  | { ok: true; clientSecret: string; sessionId: string; publishableKey: string; amount: string; summary: string }
  | { ok: false; error: string };

/** Open Stripe's payment form for a booking, from the ticket's own token. */
export async function startTicketPayment(token: string): Promise<PaymentStart> {
  const admin = createAdminClient();
  const publishableKey = stripePublishableKey();
  if (!admin || !publishableKey || !stripeReady()) return { ok: false, error: "Online payment isn’t open yet." };
  const t = await ticketCheckout(admin, token);
  if (!t.ok) {
    return {
      ok: false,
      error:
        t.reason === "paid"
          ? "This booking is already paid."
          : t.reason === "lapsed"
            ? "The hold on your spot has ended. Please book again."
            : "This can’t be paid online. Pay at the front desk.",
    };
  }
  try {
    const { id, clientSecret } = await createEmbeddedCheckout(t.input);
    return { ok: true, clientSecret, sessionId: id, publishableKey, amount: fmtAmount(t.amount, t.currency), summary: t.summary };
  } catch (e) {
    console.error("Embedded ticket checkout failed", e);
    return { ok: false, error: "We couldn’t open the payment form. Nothing was charged. Try again in a minute." };
  }
}

/** The form says it's complete: record the payment now, without waiting for the webhook. */
export async function confirmTicketPayment(sessionId: string): Promise<{ state: "paid" | "pending" | "unknown" }> {
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return { state: "unknown" };
  try {
    const r = await fulfillCheckout(sessionId);
    if (r.state === "paid") return r.kind === "ticket" ? { state: "paid" } : { state: "unknown" };
    return { state: r.state === "pending" ? "pending" : "unknown" };
  } catch (e) {
    console.error("Couldn’t record ticket payment", sessionId, e);
    return { state: "unknown" };
  }
}

/** For the portal's booking modal: the same details as the event page. */
export async function eventForModal(id: string, date: string | null) {
  const { event, memberId } = await loadEvent(id, date);
  return { event, isMember: !!memberId };
}
