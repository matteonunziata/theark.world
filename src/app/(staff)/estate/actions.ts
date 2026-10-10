"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  type ActionResult,
  fail,
  field,
  friendly,
  ok,
} from "@/lib/action-result";
import { staffOrThrow } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import {
  HOME_STATUS,
  LOT_KINDS,
  LOT_STATUS,
  MAINT_CATEGORIES,
  nights,
  RELATIONS,
  STAY_KINDS,
  STAY_SOURCES,
  STAY_STATUS,
} from "@/lib/estate";

const ESTATE = ["admin", "lead", "sales"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const refresh = (lotId?: string | null) => {
  revalidatePath("/estate", "layout");
  revalidatePath("/hospitality", "layout");
  if (lotId) revalidatePath(`/estate/${lotId}`);
};

const pick = <T extends string>(list: readonly (readonly [T, string])[], v: string | null, d: T): T =>
  (list.find(([k]) => k === v)?.[0] ?? d) as T;

const num = (data: FormData, name: string) => {
  const v = field(data, name);
  if (v === null) return null;
  const n = Number(v.replace(/[,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const cur = (v: string | null) => (v === "CRC" ? "CRC" : "USD");

export async function saveLot(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase } = await staffOrThrow(...ESTATE);
  const id = field(data, "id");

  if (data.get("intent") === "delete" && id) {
    const { error } = await supabase.from("lots").delete().eq("id", id);
    if (error) return fail(friendly(error));
    refresh();
    redirect("/estate");
  }

  const code = field(data, "code");
  if (!code) return fail("Enter the lot number.");
  const inHospitality = data.get("in_hospitality") === "on";
  const row = {
    code,
    name: field(data, "name"),
    zone: field(data, "zone"),
    kind: pick(LOT_KINDS, field(data, "kind"), "lot"),
    features: field(data, "features"),
    estate_lot_id: field(data, "estate_lot_id"),
    status: pick(LOT_STATUS, field(data, "status"), "available"),
    size_m2: num(data, "size_m2") || null,
    price: num(data, "price"),
    currency: cur(field(data, "currency")),
    owner_contact_id: field(data, "owner_contact_id"),
    photo_path: field(data, "photo_path"),
    aerial_path: field(data, "aerial_path"),
    description: field(data, "description"),
    home_status: pick(HOME_STATUS, field(data, "home_status"), "none"),
    home_name: field(data, "home_name"),
    bedrooms: num(data, "bedrooms"),
    bathrooms: num(data, "bathrooms"),
    built_m2: num(data, "built_m2") || null,
    home_notes: field(data, "home_notes"),
    in_hospitality: inHospitality,
    hospitality_since: inHospitality ? field(data, "hospitality_since") : null,
    nightly_rate: num(data, "nightly_rate"),
    rate_currency: cur(field(data, "rate_currency")),
    max_guests: num(data, "max_guests") || null,
    min_nights: Math.max(1, num(data, "min_nights") ?? 1),
    listing_notes: field(data, "listing_notes"),
  };
  // Only fields present in the form are saved, so smaller forms (the
  // hospitality panel) don't wipe the rest.
  const present = Object.fromEntries(
    Object.entries(row).filter(([k]) => data.has(k) || (k === "in_hospitality" && data.has("hospitality_form"))),
  ) as Partial<typeof row>;
  if (id) {
    const { error } = await supabase.from("lots").update(present).eq("id", id);
    if (error) return fail(error.code === "23505" ? "Another lot already has that number." : friendly(error));
    refresh(id);
    return ok("Lot saved");
  }
  const { data: lot, error } = await supabase.from("lots").insert(row).select("id").single();
  if (error) return fail(error.code === "23505" ? "Another lot already has that number." : friendly(error));
  refresh();
  redirect(`/estate/${lot.id}`);
}

/** Put a home in hospitality (from today), or take it out. */
export async function setHospitality(lotId: string, on: boolean): Promise<ActionResult> {
  const { supabase } = await staffOrThrow(...ESTATE);
  const { error } = await supabase
    .from("lots")
    .update(on ? { in_hospitality: true, hospitality_since: todayIn() } : { in_hospitality: false, hospitality_since: null })
    .eq("id", lotId);
  if (error) return fail(friendly(error));
  refresh(lotId);
  return ok(on ? "Added to hospitality" : "Removed from hospitality");
}

export async function saveHousehold(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase } = await staffOrThrow(...ESTATE);
  const id = field(data, "id");
  const lotId = field(data, "lot_id");
  if (data.get("intent") === "delete" && id) {
    const { error } = await supabase.from("lot_household").delete().eq("id", id);
    if (error) return fail(friendly(error));
    refresh(lotId);
    return ok("Removed from the household");
  }
  const name = field(data, "name");
  if (!name || !lotId) return fail("Enter a name.");
  const email = field(data, "email");
  if (email && !EMAIL.test(email)) return fail("Enter a valid email, or leave it empty.");
  const year = num(data, "birth_year");
  const row = {
    lot_id: lotId,
    name,
    relation: pick(RELATIONS, field(data, "relation"), "family"),
    contact_id: field(data, "contact_id"),
    birth_year: year && year > 1900 ? year : null,
    email,
    phone: field(data, "phone"),
    lives_on_site: data.get("lives_on_site") === "on",
    notes: field(data, "notes"),
  };
  const { error } = id
    ? await supabase.from("lot_household").update(row).eq("id", id)
    : await supabase.from("lot_household").insert(row);
  if (error) return fail(friendly(error));
  refresh(lotId);
  return ok(id ? "Saved" : `${name} added`);
}

/** Work on a property is an Operations task linked to the lot; this is its form on the property page. */
export async function saveLotTask(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase, staff } = await staffOrThrow(...ESTATE);
  const id = field(data, "id");
  const lotId = field(data, "lot_id");
  if (!lotId) return fail("Missing property.");
  if (data.get("intent") === "delete" && id) {
    const { error, count } = await supabase.from("tasks").delete({ count: "exact" }).eq("id", id).eq("lot_id", lotId);
    if (error) return fail(friendly(error));
    if (!count) return fail("You can’t delete this task. Ask an admin.");
    refresh(lotId);
    revalidatePath("/operations", "layout");
    return ok("Task deleted");
  }
  const title = field(data, "title");
  if (!title) return fail("Say what needs doing.");
  const { data: lot } = await supabase.from("lots").select("code, name").eq("id", lotId).single();
  const cost = Number(field(data, "cost"));
  const row = {
    lot_id: lotId,
    title,
    description: field(data, "description"),
    kind: "maintenance",
    maint_category: pick(MAINT_CATEGORIES, field(data, "maint_category"), "repair"),
    status: pick(
      [["backlog", ""], ["next", ""], ["doing", ""], ["review", ""], ["done", ""]] as const,
      field(data, "status"),
      "backlog",
    ),
    assignee_id: field(data, "assignee_id"),
    due_date: dateOrNull(field(data, "due_date")),
    cost: Number.isFinite(cost) && cost > 0 ? cost : null,
    currency: "CRC",
    done_by: field(data, "done_by"),
    owner_visible: data.get("owner_visible") === "on",
    location: lot ? (lot.name ?? `Lot ${lot.code}`) : null,
  };
  const { error } = id
    ? await supabase.from("tasks").update(row).eq("id", id).eq("lot_id", lotId)
    : await supabase.from("tasks").insert({ ...row, created_by: staff.id });
  if (error) return fail(friendly(error));
  refresh(lotId);
  revalidatePath("/operations", "layout");
  revalidatePath("/steward");
  return ok(id ? "Task saved" : "Task added to Operations");
}

export async function saveStay(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase, staff } = await staffOrThrow(...ESTATE);
  const id = field(data, "id");
  const lotId = field(data, "lot_id");

  if (data.get("intent") === "delete" && id) {
    const { error } = await supabase.from("stays").delete().eq("id", id);
    if (error) return fail(friendly(error));
    refresh(lotId);
    return ok("Stay deleted");
  }

  if (!lotId) return fail("Choose a home.");
  const checkIn = field(data, "check_in");
  const checkOut = field(data, "check_out");
  if (!checkIn || !checkOut) return fail("Choose check-in and check-out dates.");
  if (checkOut <= checkIn) return fail("Check-out has to be after check-in.");
  const kind = pick(STAY_KINDS, field(data, "kind"), "guest");
  const name = field(data, "guest_name") ?? (kind === "owner" ? "Owner" : kind === "hold" ? "Blocked" : null);
  if (!name) return fail("Enter the guest’s name.");
  const email = field(data, "email");
  if (email && !EMAIL.test(email)) return fail("Enter a valid email, or leave it empty.");

  const { data: lot } = await supabase
    .from("lots")
    .select("in_hospitality, min_nights, nightly_rate, rate_currency")
    .eq("id", lotId)
    .single();
  if (!lot) return fail("That home wasn’t found.");
  if (kind === "guest" && !lot.in_hospitality) {
    return fail("This home isn’t in the hospitality programme. Turn it on from the lot page first.");
  }
  const n = nights(checkIn, checkOut);
  if (kind === "guest" && n < lot.min_nights) {
    return fail(`This home has a ${lot.min_nights}-night minimum.`);
  }
  const rate = num(data, "nightly_rate") ?? (kind === "guest" ? lot.nightly_rate : null);
  const total = num(data, "total") ?? (rate !== null ? Number(rate) * n : null);
  const row = {
    lot_id: lotId,
    kind,
    status: pick(STAY_STATUS, field(data, "status"), "confirmed"),
    guest_name: name,
    email,
    phone: field(data, "phone"),
    guests: num(data, "guests") || null,
    check_in: checkIn,
    check_out: checkOut,
    nightly_rate: rate,
    currency: cur(field(data, "currency") ?? lot.rate_currency),
    total,
    paid: data.get("paid") === "on",
    source: pick(STAY_SOURCES, field(data, "source"), kind === "owner" ? "owner" : "direct"),
    notes: field(data, "notes"),
  };
  const { error } = id
    ? await supabase.from("stays").update(row).eq("id", id)
    : await supabase.from("stays").insert({ ...row, created_by: staff.id });
  if (error) {
    if (error.code === "23P01") {
      return fail("Those dates overlap a confirmed stay in this home. Pick other dates or save it as an inquiry.");
    }
    return fail(friendly(error));
  }
  refresh(lotId);
  return ok(id ? "Stay saved" : kind === "guest" ? "Stay booked" : "Dates blocked");
}

// Hospitality listings -------------------------------------------------------------

export async function saveListing(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase } = await staffOrThrow(...ESTATE);
  const id = field(data, "id");
  if (!id) return fail("Missing home.");
  const time = (v: string | null, d: string) => (v && /^\d{2}:\d{2}/.test(v) ? v : d);
  const row = {
    listing_title: field(data, "listing_title"),
    listing_summary: field(data, "listing_summary"),
    house_rules: field(data, "house_rules"),
    amenities: [
      ...data.getAll("amenity").map(String),
      ...(field(data, "amenities_other") ?? "").split(",").map((s) => s.trim()),
    ]
      .filter(Boolean)
      .filter((a, i, all) => all.indexOf(a) === i)
      .slice(0, 40),
    bedrooms: num(data, "bedrooms"),
    beds: num(data, "beds"),
    bathrooms: num(data, "bathrooms"),
    max_guests: num(data, "max_guests") || null,
    min_nights: Math.max(1, num(data, "min_nights") ?? 1),
    nightly_rate: num(data, "nightly_rate"),
    rate_currency: cur(field(data, "rate_currency")),
    cleaning_fee: num(data, "cleaning_fee"),
    check_in_time: time(field(data, "check_in_time"), "15:00"),
    check_out_time: time(field(data, "check_out_time"), "11:00"),
    listing_notes: field(data, "listing_notes"),
  };
  const { error } = await supabase.from("lots").update(row).eq("id", id);
  if (error) return fail(friendly(error));
  refresh(id);
  revalidatePath(`/hospitality/${id}`);
  revalidatePath("/stay", "layout");
  return ok("Listing saved");
}

export async function setPublished(id: string, published: boolean): Promise<ActionResult> {
  const { supabase } = await staffOrThrow(...ESTATE);
  if (published) {
    const { data: l } = await supabase.from("lots").select("in_hospitality, nightly_rate").eq("id", id).single();
    if (!l?.in_hospitality) return fail("Add the home to hospitality first.");
    if (l.nightly_rate === null) return fail("Set a nightly rate before publishing.");
  }
  const { error } = await supabase.from("lots").update({ listing_published: published }).eq("id", id);
  if (error) return fail(friendly(error));
  refresh(id);
  revalidatePath(`/hospitality/${id}`);
  revalidatePath("/stay", "layout");
  return ok(published ? "Published. Guests can find it now." : "Taken off the public site");
}

export async function addListingPhotos(lotId: string, paths: string[]): Promise<ActionResult> {
  const { supabase } = await staffOrThrow(...ESTATE);
  const { count } = await supabase
    .from("listing_photos")
    .select("id", { count: "exact", head: true })
    .eq("lot_id", lotId);
  const { error } = await supabase
    .from("listing_photos")
    .insert(paths.map((path, i) => ({ lot_id: lotId, path, position: (count ?? 0) + i })));
  if (error) return fail(friendly(error));
  revalidatePath(`/hospitality/${lotId}`);
  revalidatePath("/stay", "layout");
  return ok(paths.length === 1 ? "Photo added" : `${paths.length} photos added`);
}

export async function updateListingPhoto(
  lotId: string,
  photoId: string,
  change: { caption?: string | null; move?: -1 | 1; remove?: boolean },
): Promise<ActionResult> {
  const { supabase } = await staffOrThrow(...ESTATE);
  if (change.remove) {
    const { error } = await supabase.from("listing_photos").delete().eq("id", photoId);
    if (error) return fail(friendly(error));
  } else if (change.move) {
    const { data: photos } = await supabase
      .from("listing_photos")
      .select("id")
      .eq("lot_id", lotId)
      .order("position")
      .order("created_at");
    const ids = (photos ?? []).map((p) => p.id);
    const i = ids.indexOf(photoId);
    const j = i + change.move;
    if (i < 0 || j < 0 || j >= ids.length) return ok("");
    [ids[i], ids[j]] = [ids[j], ids[i]];
    const results = await Promise.all(
      ids.map((id, position) => supabase.from("listing_photos").update({ position }).eq("id", id)),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) return fail(friendly(failed.error));
  } else if (change.caption !== undefined) {
    const { error } = await supabase
      .from("listing_photos")
      .update({ caption: change.caption?.trim() || null })
      .eq("id", photoId);
    if (error) return fail(friendly(error));
  }
  revalidatePath(`/hospitality/${lotId}`);
  revalidatePath("/stay", "layout");
  return ok(change.remove ? "Photo removed" : change.move ? "Moved" : "Caption saved");
}

/** Block nights [from, to) so guests can't book them. */
export async function blockNights(lotId: string, from: string, to: string, label: string): Promise<ActionResult> {
  const { supabase, staff } = await staffOrThrow(...ESTATE);
  if (!(to > from)) return fail("Choose at least one night.");
  const { error } = await supabase.from("stays").insert({
    lot_id: lotId,
    kind: "hold",
    status: "confirmed",
    guest_name: label.trim() || "Blocked",
    check_in: from,
    check_out: to,
    source: "other",
    created_by: staff.id,
  });
  if (error) {
    if (error.code === "23P01") return fail("Some of those nights are already booked.");
    return fail(friendly(error));
  }
  refresh(lotId);
  revalidatePath(`/hospitality/${lotId}`);
  return ok(nights(from, to) === 1 ? "Night blocked" : `${nights(from, to)} nights blocked`);
}

export async function unblock(lotId: string, stayId: string): Promise<ActionResult> {
  const { supabase } = await staffOrThrow(...ESTATE);
  const { error } = await supabase.from("stays").delete().eq("id", stayId).eq("kind", "hold");
  if (error) return fail(friendly(error));
  refresh(lotId);
  revalidatePath(`/hospitality/${lotId}`);
  return ok("Opened up again");
}

// Stewards ------------------------------------------------------------------------

export async function addSteward(lotId: string, contactId: string): Promise<ActionResult> {
  const { supabase } = await staffOrThrow(...ESTATE);
  if (!contactId) return fail("Choose a person.");
  const { error } = await supabase.from("property_stewards").insert({ lot_id: lotId, contact_id: contactId });
  if (error) return fail(error.code === "23505" ? "They’re already a steward of this property." : friendly(error));
  refresh(lotId);
  return ok("Steward added");
}

export async function removeSteward(lotId: string, contactId: string): Promise<ActionResult> {
  const { supabase } = await staffOrThrow(...ESTATE);
  const { data: lot } = await supabase.from("lots").select("owner_contact_id").eq("id", lotId).single();
  if (lot?.owner_contact_id === contactId) {
    return fail("They’re the primary steward. Change the owner in Edit lot first.");
  }
  const { error } = await supabase.from("property_stewards").delete().eq("lot_id", lotId).eq("contact_id", contactId);
  if (error) return fail(friendly(error));
  refresh(lotId);
  return ok("Steward removed");
}

// Property financials ---------------------------------------------------------------
// Rows live in the finance ledger (admin only). All amounts are colones.

const dateOrNull = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

const refreshMoney = (lotId?: string | null) => {
  refresh(lotId);
  revalidatePath("/finance", "layout");
  revalidatePath("/crm", "layout");
};

/** Add or edit an invoice to a steward (income) or a payout to one (expense). */
export async function savePropertyEntry(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase, staff } = await staffOrThrow("admin");
  const id = field(data, "id");
  const lotId = field(data, "lot_id");
  if (!lotId) return fail("Missing property.");

  if (data.get("intent") === "delete" && id) {
    const { data: e } = await supabase.from("finance_entries").select("file_path").eq("id", id).eq("lot_id", lotId).single();
    const { error } = await supabase.from("finance_entries").delete().eq("id", id).eq("lot_id", lotId);
    if (error) return fail(friendly(error));
    if (e?.file_path) await supabase.storage.from("finance").remove([e.file_path]);
    refreshMoney(lotId);
    return ok("Deleted");
  }

  const kind = field(data, "kind");
  if (kind !== "income" && kind !== "expense") return fail("Choose an invoice or a payout.");
  const contactId = field(data, "contact_id");
  if (!contactId) return fail("Choose the steward.");
  const { data: link } = await supabase
    .from("property_stewards")
    .select("contact:contacts(name)")
    .eq("lot_id", lotId)
    .eq("contact_id", contactId)
    .maybeSingle();
  if (!link) return fail("That person isn’t a steward of this property.");
  const amount = Number(field(data, "amount"));
  if (!(amount > 0)) return fail("Enter an amount above zero.");
  const date = dateOrNull(field(data, "entry_date"));
  if (!date) return fail("Pick a date.");
  const status = pick(
    [["draft", ""], ["unpaid", ""], ["paid", ""]] as const,
    field(data, "status"),
    "unpaid",
  );
  const due = dateOrNull(field(data, "due_date"));
  if (kind === "income" && status === "unpaid" && !due) return fail("Set a due date so we can tell when it’s late.");
  const start = dateOrNull(field(data, "period_start"));
  const end = dateOrNull(field(data, "period_end"));
  if (start && end && end < start) return fail("The period ends before it starts.");

  const { data: line } = await supabase.from("business_lines").select("id").eq("name", "Real estate").maybeSingle();
  const row = {
    kind,
    lot_id: lotId,
    contact_id: contactId,
    party: link.contact?.name ?? null,
    entry_date: date,
    amount,
    currency: "CRC",
    business_line_id: line?.id ?? null,
    category: field(data, "category"),
    description: field(data, "description"),
    reference: field(data, "reference"),
    status,
    due_date: status === "unpaid" ? due : null,
    period_start: kind === "expense" ? start : null,
    period_end: kind === "expense" ? end : null,
    doc_kind: kind === "income" ? "invoice" : null,
    file_path: field(data, "file_path"),
    file_name: field(data, "file_name"),
  };
  const { error } = id
    ? await supabase.from("finance_entries").update(row).eq("id", id).eq("lot_id", lotId)
    : await supabase.from("finance_entries").insert({ ...row, created_by: staff.id });
  if (error) return fail(friendly(error));
  refreshMoney(lotId);
  const what = kind === "income" ? "Invoice" : "Payout";
  return ok(id ? `${what} saved` : status === "draft" ? `${what} saved as a draft` : `${what} added`);
}

/** Send a draft (it becomes owed) or mark an invoice or payout paid. */
export async function setPropertyEntryStatus(id: string, status: "unpaid" | "paid"): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin");
  const { data: e, error } = await supabase
    .from("finance_entries")
    .update({ status })
    .eq("id", id)
    .not("lot_id", "is", null)
    .select("lot_id")
    .single();
  if (error) return fail(friendly(error));
  refreshMoney(e.lot_id);
  return ok(status === "paid" ? "Marked as paid" : "Sent");
}

// Recurring services ----------------------------------------------------------------

const FREQ = ["once", "weekly", "monthly", "yearly"];

/** Add or edit a property's recurring service, then rebuild its upcoming tasks from the new rule. */
export async function saveService(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase } = await staffOrThrow(...ESTATE);
  const id = field(data, "id");
  const lotId = field(data, "lot_id");
  if (!lotId) return fail("Missing property.");

  if (data.get("intent") === "delete" && id) {
    // Upcoming tasks that haven't started go with it; finished ones stay in the log.
    await supabase.from("tasks").delete().eq("service_id", id).eq("status", "backlog").gte("due_date", todayIn());
    const { error } = await supabase.from("property_services").delete().eq("id", id).eq("lot_id", lotId);
    if (error) return fail(friendly(error));
    refresh(lotId);
    revalidatePath("/operations", "layout");
    return ok("Service removed");
  }

  const title = field(data, "title");
  if (!title) return fail("Name the service.");
  const freq = field(data, "freq") ?? "";
  if (!FREQ.includes(freq)) return fail("Choose how often.");
  const start = dateOrNull(field(data, "start_date"));
  if (!start) return fail("Pick a start date.");
  const end = dateOrNull(field(data, "end_date"));
  if (end && end < start) return fail("The end date is before the start.");
  const every = Math.min(52, Math.max(1, Math.round(num(data, "every") ?? 1)));
  const weekday = Math.round(num(data, "weekday") ?? Number.NaN);
  const monthDay = Math.round(num(data, "month_day") ?? Number.NaN);
  if (freq === "weekly" && !(weekday >= 0 && weekday <= 6)) return fail("Choose the day of the week.");
  if (freq === "monthly" && !(monthDay >= 1 && monthDay <= 31)) return fail("Choose the day of the month.");

  const row = {
    lot_id: lotId,
    title,
    maint_category: pick(MAINT_CATEGORIES, field(data, "maint_category"), "cleaning"),
    freq,
    every: freq === "once" ? 1 : every,
    weekday: freq === "weekly" ? weekday : null,
    month_day: freq === "monthly" ? monthDay : null,
    start_date: start,
    end_date: freq === "once" ? null : end,
    assignee_id: field(data, "assignee_id"),
    notes: field(data, "notes"),
    owner_visible: data.get("owner_visible") === "on",
    active: data.get("active") === "on",
  };
  const saved = id
    ? await supabase.from("property_services").update(row).eq("id", id).eq("lot_id", lotId).select("id").single()
    : await supabase.from("property_services").insert(row).select("id").single();
  if (saved.error) return fail(friendly(saved.error));
  const { data: made, error } = await supabase.rpc("resync_service", { p_service: saved.data.id });
  if (error) return fail(friendly(error));
  refresh(lotId);
  revalidatePath("/operations", "layout");
  return ok(row.active ? `Saved. ${made ?? 0} upcoming task${made === 1 ? "" : "s"} on the board.` : "Saved and paused");
}
