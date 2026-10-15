"use server";

import { revalidatePath } from "next/cache";
import { friendly } from "@/lib/action-result";
import { getViewer } from "@/lib/auth";
import { courtMoney, type EquipmentPick } from "@/lib/courts";
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
  phone: string;
  notes?: string;
  /** An open match is listed publicly; a private one is joined by link only. */
  match: "open" | "private";
  /** Private only: pay the whole court, or split it between the players. */
  privatePay?: "whole" | "split";
  /** Doubles (4) or singles (2). */
  spots: 2 | 4;
  level?: number | null;
  levelMin?: number | null;
  levelMax?: number | null;
  /** Private only: friends the host types in now. */
  friends?: { name: string; email: string; phone: string }[];
  equipment?: EquipmentPick[];
  website?: string; // honeypot: real people leave it empty
}): Promise<CourtResult> {
  if (input.website) return { ok: false, error: "Couldn’t book. Try again." };
  const { supabase } = await getViewer();
  const pay = payMode();
  const open = input.match === "open";
  const { data, error } = await supabase.rpc("hold_court", {
    p: {
      court_id: input.courtId,
      date: input.date,
      start: input.start,
      minutes: input.minutes,
      name: input.name,
      email: input.email,
      phone: input.phone,
      notes: input.notes ?? "",
      open_match: open,
      private_pay: open ? null : (input.privatePay ?? "split"),
      spots: input.spots,
      level: open ? input.level : null,
      level_min: open ? input.levelMin : null,
      level_max: open ? input.levelMax : null,
      friends: open ? [] : (input.friends ?? []),
      equipment: input.equipment ?? [],
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
    openMatch: open,
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

/** Join a match as one player: from the open list (booking id) or a join link (its token). */
export async function joinMatch(input: {
  key: string;
  name: string;
  email: string;
  phone: string;
  level?: number | null;
  equipment?: EquipmentPick[];
  website?: string;
}): Promise<CourtResult> {
  if (input.website) return { ok: false, error: "Couldn’t join. Try again." };
  const { supabase } = await getViewer();
  const pay = payMode();
  const { data, error } = await supabase.rpc("join_court_match", {
    p: {
      booking_id: input.key,
      share_token: input.key,
      name: input.name,
      email: input.email,
      phone: input.phone,
      level: input.level ?? null,
      equipment: input.equipment ?? [],
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

/** Cancel a booking (host, after confirming the phone on it) or leave a match (player). */
export async function cancelCourt(token: string, phone?: string): Promise<{ ok: boolean; error?: string; what?: string }> {
  const { supabase } = await getViewer();
  const { data, error } = await supabase.rpc("cancel_court_by_token", { p_token: token, p_phone: phone ?? null });
  if (error) return { ok: false, error: friendly(error) };
  refresh();
  return { ok: true, what: data ?? "booking" };
}

/** Start times that are free for a booking being moved. */
export async function freeStarts(courtId: string, date: string, minutes: number, bookingId: string): Promise<string[]> {
  const { supabase } = await getViewer();
  const { data } = await supabase.rpc("court_free_starts", { p_court: courtId, p_date: date, p_minutes: minutes, p_ignore: bookingId });
  return (data ?? []).map((t) => t.slice(0, 5));
}

export type MoveResult =
  | { ok: true; date: string; start: string; end: string; amount: number; credit: number; owed: number; movesLeft: number }
  | { ok: false; error: string };

type Moved = { date: string; start_time: string; end_time: string; amount: number; credit: number; owed: number; moves_left: number };
const moved = (m: Moved): MoveResult => ({
  ok: true,
  date: m.date,
  start: m.start_time.slice(0, 5),
  end: m.end_time.slice(0, 5),
  amount: Number(m.amount),
  credit: Number(m.credit),
  owed: Number(m.owed),
  movesLeft: m.moves_left,
});

/** Move a booking with its private link, after confirming the phone number on it. */
export async function moveCourt(token: string, phone: string, date: string, start: string, minutes: number): Promise<MoveResult> {
  const { supabase } = await getViewer();
  const { data, error } = await supabase.rpc("move_court_booking", {
    p_token: token,
    p_phone: phone,
    p_date: date,
    p_start: start,
    p_minutes: minutes,
  });
  if (error || !data) return { ok: false, error: friendly(error) };
  refresh();
  return moved(data as Moved);
}

/** Add equipment for yourself on your booking page. */
export async function addCourtEquipment(token: string, items: EquipmentPick[]): Promise<{ ok: boolean; error?: string }> {
  if (!items.length) return { ok: false, error: "Pick something to add." };
  const { supabase } = await getViewer();
  const { error } = await supabase.rpc("add_court_equipment_by_token", { p_token: token, p_items: items });
  if (error) return { ok: false, error: friendly(error) };
  refresh();
  return { ok: true };
}
