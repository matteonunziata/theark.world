"use server";

import { revalidatePath } from "next/cache";
import {
  type ActionResult,
  fail,
  field,
  friendly,
  ok,
} from "@/lib/action-result";
import { staffOrThrow } from "@/lib/auth";
import { notifyLater } from "@/lib/slack";
import { taskMessage } from "@/lib/slack-format";
import { PRIORITIES, STATUSES, TASK_KINDS } from "@/lib/tasks";

const pick = <T extends readonly (readonly [string, string])[]>(
  list: T,
  v: string | null,
  d: string,
) => (list.some(([k]) => k === v) ? (v as string) : d);

const MAINT = ["repair", "garden", "pool", "cleaning", "inspection", "build", "other"];

/** Cost, type, contractor and owner visibility only mean something on a property. */
function propertyWork(data: FormData) {
  if (!field(data, "lot_id")) {
    return { maint_category: null, cost: null, currency: "CRC", done_by: null, owner_visible: true };
  }
  const cat = field(data, "maint_category");
  const cost = Number(field(data, "cost"));
  return {
    maint_category: MAINT.includes(cat ?? "") ? cat : "repair",
    // Employees never see the cost field, so leave what's saved alone when it isn't sent.
    ...(data.has("cost") ? { cost: Number.isFinite(cost) && cost > 0 ? cost : null } : {}),
    currency: "CRC",
    done_by: field(data, "done_by"),
    owner_visible: data.get("owner_visible") === "on",
  };
}

export async function saveTask(
  _prev: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  const { supabase, staff } = await staffOrThrow();
  const id = field(data, "id");

  if (data.get("intent") === "delete" && id) {
    const { error, count } = await supabase
      .from("tasks")
      .delete({ count: "exact" })
      .eq("id", id);
    if (error) return fail(friendly(error));
    if (!count) return fail("You can’t delete this task.");
    revalidatePath("/operations", "layout");
    return ok("Task deleted");
  }

  const title = field(data, "title");
  if (!title) return fail("Enter a title.");
  // Where: an amenity, or a lot/house (which puts it in that property's log and calendar).
  const where = field(data, "where") === "lot" ? "lot" : field(data, "where") === "amenity" ? "amenity" : "none";
  const lotId = where === "lot" ? field(data, "lot_id") : null;
  const amenityId = where === "amenity" ? field(data, "amenity_id") : null;
  if (where === "lot" && !lotId) return fail("Choose the lot or house.");
  if (where === "lot" && !field(data, "due_date")) return fail("Pick a date so it shows on the property’s calendar.");
  const amenityName = amenityId
    ? ((await supabase.from("amenities").select("name").eq("id", amenityId).maybeSingle()).data?.name ?? null)
    : null;
  const hours = Number(field(data, "planned_hours"));
  data.set("lot_id", lotId ?? "");
  const row = {
    title,
    description: field(data, "description"),
    assignee_id: field(data, "assignee_id"),
    division_id: field(data, "division_id"),
    priority: pick(PRIORITIES, field(data, "priority"), "medium"),
    kind: pick(TASK_KINDS, field(data, "kind"), "task"),
    due_date: field(data, "due_date"),
    location: amenityName ?? (where === "none" ? field(data, "location") : null),
    amenity_id: amenityId,
    planned_hours: hours > 0 ? hours : null,
    start_time: field(data, "start_time"),
    status: pick(STATUSES, field(data, "status"), "backlog"),
    // Work on a property: shows in that property's maintenance log.
    lot_id: lotId,
    ...propertyWork(data),
  };
  const { data: before } = id
    ? await supabase.from("tasks").select("assignee_id").eq("id", id).maybeSingle()
    : { data: null };
  const { error } = id
    ? await supabase.from("tasks").update(row).eq("id", id)
    : await supabase.from("tasks").insert({ ...row, created_by: staff.id });
  if (error) return fail(friendly(error));
  revalidatePath("/operations", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/estate", "layout");
  revalidatePath("/steward");

  // Someone new is on it (and it isn't the person saving): a word on Slack.
  if (row.assignee_id && row.assignee_id !== before?.assignee_id && row.assignee_id !== staff.id) {
    const { data: who } = await supabase.from("team_members").select("name").eq("id", row.assignee_id).maybeSingle();
    const t = {
      title,
      assignee: who?.name ?? "someone",
      by: staff.name,
      dueDate: row.due_date,
      priority: row.priority,
      description: row.description,
    };
    notifyLater("task", (origin) => taskMessage(t, origin));
  }
  return ok(id ? "Changes saved" : "Task added");
}

export async function setTaskStatus(id: string, status: string) {
  const { supabase } = await staffOrThrow();
  if (!STATUSES.some(([k]) => k === status)) return fail("Unknown stage.");
  const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
  if (error) return fail(friendly(error));
  revalidatePath("/operations", "layout");
  revalidatePath("/dashboard");
  return ok("Moved");
}

/** Quick personal to-do from the dashboard, assigned to whoever adds it. */
export async function addTodo(title: string) {
  const { supabase, staff } = await staffOrThrow();
  const t = title.trim();
  if (!t) return fail("Write the to-do first.");
  const { error } = await supabase.from("tasks").insert({
    title: t,
    assignee_id: staff.id,
    created_by: staff.id,
    division_id: staff.division_id,
    status: "next",
  });
  if (error) return fail(friendly(error));
  revalidatePath("/dashboard");
  revalidatePath("/operations", "layout");
  return ok("Added");
}
