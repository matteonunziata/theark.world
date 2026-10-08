"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, fail, field, friendly, ok } from "@/lib/action-result";
import { staffOrThrow } from "@/lib/auth";

const ROLES = ["admin", "lead", "sales"];

const amount = (data: FormData, name: string) => {
  const v = field(data, name);
  if (v === null) return 0;
  const n = Number(v.replace(/[,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** Cleaning and maintenance share the same tables, told apart by kind. */
const kindOf = (data: FormData) => (data.get("kind") === "maintenance" ? "maintenance" : "cleaning");

export async function saveCleaningTask(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase } = await staffOrThrow(...ROLES);
  const id = field(data, "id");
  const kind = kindOf(data);

  if (data.get("intent") === "delete" && id) {
    const { error } = await supabase.from("cleaning_tasks").delete().eq("id", id).eq("kind", kind);
    if (error) return fail(friendly(error));
    revalidatePath(`/operations/${kind}`);
    return ok("Task removed");
  }

  const area = field(data, "area");
  const task = field(data, "task");
  if (!area) return fail("Enter where it happens, like Kitchen or The Ark House.");
  if (!task) return fail("Enter what needs doing.");
  const days = [...new Set(data.getAll("days").map(Number))]
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    .sort();
  if (!days.length) return fail("Choose at least one day.");
  const start = field(data, "start_time");
  if (start && !/^\d{2}:\d{2}$/.test(start)) return fail("Enter the start time as hours and minutes.");
  const hours = amount(data, "hours");
  if (hours === null || hours > 24) return fail("Enter the length in hours, like 1.5.");

  const row = {
    kind,
    area,
    task,
    days,
    staff_id: field(data, "staff_id"),
    start_time: start,
    hours: hours || null,
    notes: field(data, "notes"),
  };
  const { error } = id
    ? await supabase.from("cleaning_tasks").update(row).eq("id", id).eq("kind", kind)
    : await supabase.from("cleaning_tasks").insert(row);
  if (error) return fail(friendly(error));
  revalidatePath(`/operations/${kind}`);
  return ok(id ? "Task saved" : "Task added");
}

export async function saveCleaningStaff(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase } = await staffOrThrow(...ROLES);
  const id = field(data, "id");
  const kind = kindOf(data);

  if (data.get("intent") === "delete" && id) {
    const { error } = await supabase.from("cleaning_staff").delete().eq("id", id).eq("kind", kind);
    if (error) return fail(friendly(error));
    revalidatePath(`/operations/${kind}`);
    return ok("Removed. Their tasks are now unassigned.");
  }

  const name = field(data, "name");
  if (!name) return fail("Enter their name.");
  const rate = field(data, "hourly_rate");
  const hourly = rate === null ? null : Number(rate.replace(/[,\s]/g, ""));
  if (hourly !== null && !(Number.isFinite(hourly) && hourly >= 0)) return fail("Enter the hourly rate as a number.");
  const color = field(data, "color");
  const row = {
    kind,
    name,
    hourly_rate: hourly,
    currency: field(data, "currency") === "USD" ? "USD" : "CRC",
    ...(color && /^#[0-9a-fA-F]{6}$/.test(color) ? { color } : {}),
  };
  const { error } = id
    ? await supabase.from("cleaning_staff").update(row).eq("id", id).eq("kind", kind)
    : await supabase.from("cleaning_staff").insert(row);
  if (error) return fail(friendly(error));
  revalidatePath(`/operations/${kind}`);
  return ok(id ? "Saved" : "Added to the team");
}
