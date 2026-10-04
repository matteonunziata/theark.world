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
import { PRIORITIES, STATUSES, TASK_KINDS } from "@/lib/tasks";

const pick = <T extends readonly (readonly [string, string])[]>(
  list: T,
  v: string | null,
  d: string,
) => (list.some(([k]) => k === v) ? (v as string) : d);

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
  const row = {
    title,
    description: field(data, "description"),
    assignee_id: field(data, "assignee_id"),
    division_id: field(data, "division_id"),
    priority: pick(PRIORITIES, field(data, "priority"), "medium"),
    kind: pick(TASK_KINDS, field(data, "kind"), "task"),
    due_date: field(data, "due_date"),
    location: field(data, "location"),
    status: pick(STATUSES, field(data, "status"), "backlog"),
  };
  const { error } = id
    ? await supabase.from("tasks").update(row).eq("id", id)
    : await supabase.from("tasks").insert({ ...row, created_by: staff.id });
  if (error) return fail(friendly(error));
  revalidatePath("/operations", "layout");
  revalidatePath("/dashboard");
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
