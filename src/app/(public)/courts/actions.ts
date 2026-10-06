"use server";

import { revalidatePath } from "next/cache";
import { friendly } from "@/lib/action-result";
import { getViewer } from "@/lib/auth";
import { courtMoney } from "@/lib/courts";
import { sendCourtEmail } from "@/lib/email";
import { notifyLater } from "@/lib/slack";
import { courtMessage } from "@/lib/slack-format";
import { stripeReady } from "@/lib/stripe";

// The public court page. Every rule (hours, two weeks ahead, two slots a
// day, classes, overlaps, levels, spots) lives in the database functions;
// these actions pass the form through and decide what happens next: Stripe,
// or straight to the booking page.

export type CourtResult =
  | {
      ok: true;
      /** The booking page for this person (their own token). */
      token: string;
      /** Where to pay, when the slot is held for payment. */
      payUrl: string | null;
      amount: number;
      currency: string;
      status: string;
    }
  | { ok: false; error: string };

type Held = { id: string; token: string; player_token?: string; booking_token?: string; amount: number; currency: string; status: string };

const refresh = () => {
  revalidatePath("/courts", "layout");
  revalidatePath("/events/courts");
  revalidatePath("/portal/schedule");
};

/** Everyone pays when they book (members with their discount). Only while Stripe is off is it settled at reception. */
const payMode = () => (stripeReady() ? "online" : "reception");

/** Hold or book a court for a visitor or a member. */
export async function holdCourt(input: {
  courtId: string;
  date: string;
  start: string;
  minutes: number;
  name: string;
  email: string;
  phone?: string;
  players?: number | null;
  notes?: string;
  openMatch: boolean;
  level?: number | null;
  spots?: number | null;
  levelMin?: number | null;
  levelMax?: number | null;
  pay?: "online" | "reception";
  website?: string; // honeypot: real people leave it empty
}): Promise<CourtResult> {
  if (input.website) return { ok: false, error: "Couldn’t book. Try again." };
  const { supabase } = await getViewer();
  const pay = payMode();
  const { data, error } = await supabase.rpc("hold_court", {
    p: {
      court_id: input.courtId,
      date: input.date,
      start: input.start,
      minutes: input.minutes,
      name: input.name,
      email: input.email,
      phone: input.phone ?? "",
      players: input.players ?? null,
      notes: input.notes ?? "",
      open_match: input.openMatch,
      level: input.openMatch ? input.level : null,
      spots: input.openMatch ? input.spots : null,
      level_min: input.openMatch ? input.levelMin : null,
      level_max: input.openMatch ? input.levelMax : null,
      pay,
    },
  });
  if (error || !data) return { ok: false, error: friendly(error) };
  const h = data as Held;
  const token = h.player_token ?? h.token;
  refresh();

  const held = h.status === "held";
  if (!held) {
    // Booked without payment (a member settling at reception, or Stripe off): tell them now.
    try {
      await sendCourtEmail(supabase, token);
    } catch (e) {
      console.error("Court email failed", e);
    }
  }
  const b = {
    holder: input.name,
    court: "",
    date: input.date,
    startTime: input.start,
    endTime: "",
    minutes: input.minutes,
    amount: h.amount ? courtMoney(h.amount, h.currency) : null,
    openMatch: input.openMatch,
    status: h.status,
  };
  notifyLater("booking", async (origin) => {
    const { data: d } = await supabase.rpc("court_booking_by_token", { p_token: token });
    const bk = (d as { booking?: { court: string; end_time: string } } | null)?.booking;
    return courtMessage({ ...b, court: bk?.court ?? "Court", endTime: bk?.end_time ?? input.start }, origin);
  });
  return {
    ok: true,
    token,
    payUrl: held ? `/pay/court/${token}` : null,
    amount: Number(h.amount),
    currency: h.currency,
    status: h.status,
  };
}

/** Join an open match as one player. */
export async function joinMatch(input: {
  bookingId: string;
  name: string;
  email: string;
  phone?: string;
  level: number;
  pay?: "online" | "reception";
  website?: string;
}): Promise<CourtResult> {
  if (input.website) return { ok: false, error: "Couldn’t join. Try again." };
  const { supabase } = await getViewer();
  const pay = payMode();
  const { data, error } = await supabase.rpc("join_court_match", {
    p: {
      booking_id: input.bookingId,
      name: input.name,
      email: input.email,
      phone: input.phone ?? "",
      level: input.level,
      pay,
    },
  });
  if (error || !data) return { ok: false, error: friendly(error) };
  const h = data as Held;
  refresh();
  const held = h.status === "held";
  if (!held) {
    try {
      await sendCourtEmail(supabase, h.token);
    } catch (e) {
      console.error("Court email failed", e);
    }
  }
  notifyLater("booking", async (origin) => {
    const { data: d } = await supabase.rpc("court_booking_by_token", { p_token: h.token });
    const bk = (d as { booking?: { court: string; date: string; start_time: string; end_time: string } } | null)?.booking;
    if (!bk) return null;
    return courtMessage(
      {
        holder: input.name,
        court: bk.court,
        date: bk.date,
        startTime: bk.start_time,
        endTime: bk.end_time,
        minutes: 0,
        amount: h.amount ? courtMoney(h.amount, h.currency) : null,
        openMatch: true,
        joined: true,
        status: h.status,
      },
      origin,
    );
  });
  return {
    ok: true,
    token: h.token,
    payUrl: held ? `/pay/court/${h.token}` : null,
    amount: Number(h.amount),
    currency: h.currency,
    status: h.status,
  };
}

/** Cancel a booking (host) or leave a match (player), by the token on their page. */
export async function cancelCourt(token: string): Promise<{ ok: boolean; error?: string; what?: string }> {
  const { supabase } = await getViewer();
  const { data, error } = await supabase.rpc("cancel_court_by_token", { p_token: token });
  if (error) return { ok: false, error: friendly(error) };
  refresh();
  return { ok: true, what: data ?? "booking" };
}
