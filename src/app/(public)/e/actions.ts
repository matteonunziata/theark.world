"use server";

import { revalidatePath } from "next/cache";
import { fail, friendly } from "@/lib/action-result";
import { sendTicketEmail } from "@/lib/email";
import { notifyLater } from "@/lib/slack";
import { bookingMessage } from "@/lib/slack-format";
import { stripeReady } from "@/lib/stripe";
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
  };
}

/** For the portal's booking modal: the same details as the event page. */
export async function eventForModal(id: string, date: string | null) {
  const { event, memberId } = await loadEvent(id, date);
  return { event, isMember: !!memberId };
}
