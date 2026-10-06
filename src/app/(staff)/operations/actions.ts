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
  const { data: before } = id
    ? await supabase.from("tasks").select("assignee_id").eq("id", id).maybeSingle()
    : { data: null };
  const { error } = id
    ? await supabase.from("tasks").update(row).eq("id", id)
    : await supabase.from("tasks").insert({ ...row, created_by: staff.id });
  if (error) return fail(friendly(error));
  revalidatePath("/operations", "layout");
  revalidatePath("/dashboard");

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
