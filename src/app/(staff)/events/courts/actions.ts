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

/** Book a court for someone from the schedule. Same rules as the public page: lengths, half-hour starts, no overlaps. */
export async function bookCourtForGuest(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase } = await staffOrThrow(...BOOKERS);
  const name = field(data, "name");
  if (!name) return fail("Enter who the court is for.");
  const email = field(data, "email");
  if (email && !EMAIL.test(email)) return fail("That email doesn’t look right.");
  const courtId = field(data, "court_id");
  const date = field(data, "date");
  const start = field(data, "start_time");
  if (!courtId || !date || !start || !DATE.test(date) || !TIME.test(start)) return fail("Pick a slot.");
  const open = data.get("match") === "open";
  const level = Number(field(data, "level") ?? "") || 2.5;
  const { data: res, error } = await supabase.rpc("hold_court", {
    p: {
      staff: true,
      court_id: courtId,
      date,
      start,
      minutes: Number(field(data, "minutes") ?? 60),
      name,
      email: email ?? "",
      phone: field(data, "phone") ?? "",
      contact_id: field(data, "contact_id"),
      notes: field(data, "notes") ?? "",
      open_match: open,
      private_pay: open ? null : (field(data, "private_pay") ?? "split"),
      spots: Number(field(data, "spots") ?? 4),
      level: open ? level : null,
      level_min: open ? Math.max(0, level - 1) : null,
      level_max: open ? Math.min(7, level + 1) : null,
      pay: "reception",
    },
  });
  if (error || !res) return fail(friendly(error));
  refresh();
  return ok(`Booked for ${name}`);
}

/** Add or edit a court (admins and division leads). The prices are in the price list. */
export async function saveCourt(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin", "lead");
  const id = field(data, "id");
  const name = field(data, "name");
  if (!name) return fail("Give the court a name.");
  const open = field(data, "open_time") ?? "07:00";
  const close = field(data, "close_time") ?? "20:00";
  if (!TIME.test(open) || !TIME.test(close) || close <= open) return fail("Closing time must be after opening time.");
  const sport = field(data, "sport");
  const row = {
    name,
    sport: SPORTS.some(([k]) => k === sport) ? sport! : "padel",
    open_time: open,
    close_time: close,
    slot_minutes: 30,
    active: data.get("active") === "on",
    description: field(data, "description"),
    max_players: 4,
  };
  const { error } = id
    ? await supabase.from("courts").update(row).eq("id", id)
    : await supabase.from("courts").insert(row);
  if (error) return fail(friendly(error));
  refresh();
  return ok(id ? "Court saved" : "Court added");
}

/** Change the prices and the dollar rate (admins and leads). VAT is included in every price. */
export async function savePrices(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin", "lead");
  const { data: rows } = await supabase.from("court_prices").select("key");
  for (const r of rows ?? []) {
    const raw = field(data, `price_${r.key}`);
    if (raw === null) continue;
    const price = Number(raw);
    if (!Number.isFinite(price) || price < 0) return fail("Prices must be zero or more.");
    const { error } = await supabase.from("court_prices").update({ price, active: data.get(`active_${r.key}`) === "on" }).eq("key", r.key);
    if (error) return fail(friendly(error));
  }
  const rate = Number(field(data, "usd_crc_rate") ?? "");
  if (Number.isFinite(rate) && rate > 0) {
    const { error } = await supabase.from("court_config").update({ value: rate }).eq("key", "usd_crc_rate");
    if (error) return fail(friendly(error));
  }
  const vat = Number(field(data, "vat_percent") ?? "");
  if (Number.isFinite(vat) && vat >= 0 && vat < 100) {
    const { error } = await supabase.from("court_config").update({ value: vat }).eq("key", "vat_percent");
    if (error) return fail(friendly(error));
  }
  refresh();
  return ok("Prices saved");
}

/** Block a court for a class from the schedule. The public can't book it. */
export async function blockCourt(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase } = await staffOrThrow(...BOOKERS);
  const courtId = field(data, "court_id");
  const date = field(data, "date");
  const start = field(data, "start_time");
  const end = field(data, "end_time");
  if (!courtId || !date || !start || !end || !DATE.test(date) || !TIME.test(start) || !TIME.test(end)) return fail("Pick the court and times.");
  const { error } = await supabase.rpc("staff_block_court", {
    p_court: courtId,
    p_date: date,
    p_start: start,
    p_end: end,
    p_title: field(data, "title") ?? "Class",
  });
  if (error) return fail(friendly(error));
  refresh();
  return ok("Court blocked for the class");
}

type Done = { ok: boolean; error?: string; message?: string };
const done = (error: { code?: string; message?: string } | null, message: string): Done =>
  error ? { ok: false, error: friendly(error) } : (refresh(), { ok: true, message });

/** The community manager's tools, one call each so the drawer stays open. */
export async function courtAction(
  op:
    | { type: "add_player"; booking: string; name: string; email: string; phone: string }
    | { type: "update_player"; player: string; name: string; email: string; phone: string }
    | { type: "check_in"; player: string; value: boolean }
    | { type: "add_equipment"; booking: string; player: string; item: string; qty: number }
    | { type: "remove_equipment"; id: string }
    | { type: "pay"; booking: string; player: string; method: string; amount: number | null; usd: number | null; note?: string }
    | { type: "start"; booking: string; reason?: string }
    | { type: "cancel"; booking: string },
): Promise<Done & { detail?: string }> {
  const { supabase } = await staffOrThrow(...BOOKERS);
  switch (op.type) {
    case "add_player": {
      if (op.email && !EMAIL.test(op.email.trim())) return { ok: false, error: "That email doesn’t look right." };
      const { error } = await supabase.rpc("staff_add_court_player", { p_booking: op.booking, p_name: op.name, p_email: op.email, p_phone: op.phone });
      return done(error, "Player added");
    }
    case "update_player": {
      const { error } = await supabase.rpc("staff_update_court_player", { p_player: op.player, p_name: op.name, p_email: op.email, p_phone: op.phone });
      return done(error, "Saved");
    }
    case "check_in": {
      const { error } = await supabase.rpc("staff_check_in_court_player", { p_player: op.player, p_in: op.value });
      return done(error, op.value ? "Checked in" : "Check-in removed");
    }
    case "add_equipment": {
      const { error } = await supabase.rpc("staff_add_court_equipment", { p_booking: op.booking, p_player: op.player, p_item: op.item, p_qty: op.qty });
      return done(error, "Equipment added");
    }
    case "remove_equipment": {
      const { error } = await supabase.rpc("staff_remove_court_equipment", { p_id: op.id });
      return done(error, "Equipment removed");
    }
    case "pay": {
      const { data, error } = await supabase.rpc("staff_take_court_payment", {
        p_booking: op.booking,
        p_player: op.player,
        p_method: op.method,
        p_amount: op.amount,
        p_usd: op.usd,
        p_note: op.note ?? null,
      });
      if (error) return { ok: false, error: friendly(error) };
      refresh();
      const r = data as { credited: number; usd: number | null; rate: number; owed: number };
      const detail = r.usd
        ? `$${r.usd} at ₡${r.rate} = ₡${Math.round(r.credited).toLocaleString("en-US")} counted`
        : `₡${Math.round(r.credited).toLocaleString("en-US")} counted`;
      return { ok: true, message: r.owed > 0 ? `Payment taken, ${detail}. ₡${Math.round(r.owed).toLocaleString("en-US")} still owed` : `Payment taken, ${detail}. All paid`, detail };
    }
    case "start": {
      const { data, error } = await supabase.rpc("staff_start_court_game", { p_booking: op.booking, p_override_reason: op.reason ?? null });
      if (error) return { ok: false, error: friendly(error) };
      refresh();
      return { ok: true, message: (data as { override: boolean }).override ? "Game started with an override (recorded)" : "Game started" };
    }
    case "cancel": {
      const { error } = await supabase.rpc("staff_cancel_court", { p_booking: op.booking });
      return done(error, "Booking cancelled");
    }
  }
}
