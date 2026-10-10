"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, fail, field, friendly, ok } from "@/lib/action-result";
import { getViewer } from "@/lib/auth";
import { RELATIONS } from "@/lib/estate";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Owners act through RLS and the owner_* functions, which check ownership themselves. */
async function owner() {
  const v = await getViewer();
  if (!v.memberId) throw new Error("Sign in to the members portal.");
  return v.supabase;
}

const refresh = () => revalidatePath("/portal/property");

export async function saveMyHousehold(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  const supabase = await owner();
  const id = field(data, "id");
  const lotId = field(data, "lot_id");
  if (!lotId) return fail("Missing property.");
  if (data.get("intent") === "delete" && id) {
    const { error } = await supabase.from("lot_household").delete().eq("id", id).eq("lot_id", lotId);
    if (error) return fail(friendly(error));
    refresh();
    return ok("Removed");
  }
  const name = field(data, "name");
  if (!name) return fail("Enter a name.");
  const email = field(data, "email");
  if (email && !EMAIL.test(email)) return fail("Enter a valid email, or leave it empty.");
  const year = Number(field(data, "birth_year"));
  const relation = field(data, "relation");
  const row = {
    lot_id: lotId,
    name,
    relation: RELATIONS.find(([k]) => k === relation)?.[0] ?? "family",
    birth_year: year > 1900 && year < 2100 ? year : null,
    email,
    phone: field(data, "phone"),
    lives_on_site: data.get("lives_on_site") === "on",
    notes: field(data, "notes"),
  };
  const { error } = id
    ? await supabase.from("lot_household").update(row).eq("id", id).eq("lot_id", lotId)
    : await supabase.from("lot_household").insert(row);
  if (error) return fail(friendly(error));
  refresh();
  return ok(id ? "Saved" : `${name} added`);
}

export async function requestWork(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  const supabase = await owner();
  const { error } = await supabase.rpc("owner_request_work", {
    p_lot: field(data, "lot_id") ?? "",
    p_title: field(data, "title") ?? "",
    p_category: field(data, "category") ?? "repair",
    p_details: field(data, "details"),
  });
  if (error) return fail(friendly(error));
  refresh();
  return ok("Sent to the team");
}

export async function blockMyDates(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  const supabase = await owner();
  const from = field(data, "from");
  const to = field(data, "to");
  if (!from || !to) return fail("Choose your arrival and departure dates.");
  const { error } = await supabase.rpc("owner_block_dates", {
    p_lot: field(data, "lot_id") ?? "",
    p_from: from,
    p_to: to,
    p_note: field(data, "note"),
  });
  if (error) {
    if (error.code === "23P01") return fail("Those dates overlap a confirmed stay. Pick other dates.");
    return fail(friendly(error));
  }
  refresh();
  return ok("Dates saved. Guests can’t book them.");
}

export async function cancelMyDates(stayId: string): Promise<ActionResult> {
  const supabase = await owner();
  const { error } = await supabase.rpc("owner_cancel_block", { p_stay: stayId });
  if (error) return fail(friendly(error));
  refresh();
  return ok("Dates released");
}

export async function saveMyNotes(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  const supabase = await owner();
  const { error } = await supabase.rpc("owner_set_listing_notes", {
    p_lot: field(data, "lot_id") ?? "",
    p_notes: field(data, "notes"),
  });
  if (error) return fail(friendly(error));
  refresh();
  return ok("Notes saved");
}
