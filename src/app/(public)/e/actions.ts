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
    }
  | { ok: false; error: string };

/** Public and member booking. All checks happen in book_session. */
export async function bookSession(input: {
  offeringId: string;
  date: string;
  name: string;
  email: string;
  ticketTypeId: string | null;
  website?: string; // honeypot: real people leave it empty
}): Promise<BookingResult> {
  if (input.website) return { ok: false, error: "Couldn’t book. Try again." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("book_session", {
      p_offering_id: input.offeringId,
      p_session_date: input.date,
      p_name: input.name,
      p_email: input.email,
      p_ticket_type_id: input.ticketTypeId ?? undefined,
    })
    .single();
  if (error || !data) {
    const r = fail(friendly(error));
    return { ok: false, error: r.error ?? "Couldn’t book. Try again." };
  }

  const { data: t } = await supabase
    .rpc("ticket_by_token", { p_token: data.qr_token })
    .single();
  const { data: tt } = input.ticketTypeId
    ? await supabase
        .from("ticket_types")
        .select("payment_link, price, currency")
        .eq("id", input.ticketTypeId)
        .maybeSingle()
    : { data: null };
  const { data: org } = await supabase.rpc("public_org").maybeSingle();

  let emailed = false;
  const to = input.email.trim().toLowerCase();
  if (t) {
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
  const paid = tt && Number(tt.price) > 0;
  const price = paid
    ? tt.currency === "USD"
      ? `$${Number(tt.price).toLocaleString("en-US")}`
      : `₡${Number(tt.price).toLocaleString("en-US")}`
    : null;
  if (t) {
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
  return {
    ok: true,
    token: data.qr_token,
    emailed,
    // A link without a price (meals) still needs paying.
    paymentLink: tt?.payment_link ?? null,
    payUrl: paid && !tt.payment_link && stripeReady() ? `/pay/ticket/${data.qr_token}` : null,
    price,
  };
}

/** For the portal's booking modal: the same details as the event page. */
export async function eventForModal(id: string, date: string | null) {
  const { event, memberId } = await loadEvent(id, date);
  return { event, isMember: !!memberId };
}
