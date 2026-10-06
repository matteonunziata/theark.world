"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, fail, field, friendly, ok } from "@/lib/action-result";
import { staffOrThrow } from "@/lib/auth";
import { SPORTS } from "@/lib/courts";

const BOOKERS = ["admin", "lead", "sales", "facilitator"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIME = /^\d{2}:\d{2}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const refresh = () => {
  revalidatePath("/events/courts");
  revalidatePath("/portal/schedule");
  revalidatePath("/courts", "layout");
};

/** Book a court slot for someone, or edit / cancel a booking. */
export async function saveCourtBooking(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase, staff } = await staffOrThrow(...BOOKERS);
  const id = field(data, "id");
  if (data.get("intent") === "delete" && id) {
    const { error } = await supabase.from("court_bookings").update({ status: "cancelled" }).eq("id", id);
    if (error) return fail(friendly(error));
    refresh();
    return ok("Booking cancelled");
  }
  const name = field(data, "name");
  if (!name) return fail("Enter who the court is for.");
  const email = field(data, "email");
  if (email && !EMAIL.test(email)) return fail("That email doesn’t look right.");
  const players = Number(field(data, "players") ?? "") || null;
  const row = {
    name,
    email,
    phone: field(data, "phone"),
    contact_id: field(data, "contact_id"),
    players: players ? Math.min(8, Math.max(1, players)) : null,
    notes: field(data, "notes"),
    paid: data.get("paid") === "on",
  };
  const courtId = field(data, "court_id");
  const date = field(data, "date");
  const start = field(data, "start_time");
  const end = field(data, "end_time");
  if (id) {
    // Moving or resizing is optional: the form sends the slot only when it can be changed.
    const moved = courtId && date && start && end;
    if (moved && (!DATE.test(date) || !TIME.test(start) || !TIME.test(end) || end <= start)) return fail("The end must be after the start.");
    const { error } = await supabase
      .from("court_bookings")
      .update(moved ? { ...row, court_id: courtId, date, start_time: start, end_time: end } : row)
      .eq("id", id);
    if (error) return fail(error.code === "23P01" ? "That time is already booked. Pick another." : friendly(error));
    refresh();
    return ok("Saved");
  }
  if (!courtId || !date || !start || !end || !TIME.test(start) || !TIME.test(end)) return fail("Pick a slot.");
  const { error } = await supabase
    .from("court_bookings")
    .insert({ ...row, court_id: courtId, date, start_time: start, end_time: end, source: "staff", created_by: staff.id });
  if (error) return fail(error.code === "23P01" ? "That slot was just taken. Pick another." : friendly(error));
  refresh();
  return ok(`Booked for ${name}`);
}

/** Add or edit a court (admins and division leads). */
export async function saveCourt(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin", "lead");
  const id = field(data, "id");
  const name = field(data, "name");
  if (!name) return fail("Give the court a name.");
  const open = field(data, "open_time") ?? "07:00";
  const close = field(data, "close_time") ?? "20:00";
  if (!TIME.test(open) || !TIME.test(close) || close <= open) return fail("Closing time must be after opening time.");
  const sport = field(data, "sport");
  const price = Number(field(data, "price") ?? "");
  // Longer lengths: empty means the slot price scaled by length.
  const longer = (k: string) => {
    const v = field(data, k);
    const n = v === null ? NaN : Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const currency = field(data, "currency");
  const row = {
    name,
    sport: SPORTS.some(([k]) => k === sport) ? sport! : "padel",
    open_time: open,
    close_time: close,
    slot_minutes: Math.min(240, Math.max(15, Number(field(data, "slot_minutes")) || 60)),
    active: data.get("active") === "on",
    price: Number.isFinite(price) && price >= 0 ? price : 0,
    price_90: longer("price_90"),
    price_120: longer("price_120"),
    currency: currency === "USD" ? "USD" : "CRC",
    description: field(data, "description"),
    max_players: Math.min(8, Math.max(2, Number(field(data, "max_players")) || 4)),
  };
  const { error } = id
    ? await supabase.from("courts").update(row).eq("id", id)
    : await supabase.from("courts").insert(row);
  if (error) return fail(friendly(error));
  refresh();
  return ok(id ? "Court saved" : "Court added");
}
