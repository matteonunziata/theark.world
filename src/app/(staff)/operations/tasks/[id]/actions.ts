"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, fail, field, friendly, ok } from "@/lib/action-result";
import { isBudgetAdmin, staffOrThrow } from "@/lib/auth";
import { notifyLater } from "@/lib/slack";
import { budgetRequestMessage, taskPingMessage } from "@/lib/slack-format";
import { parseHours } from "@/lib/tasks";

const refresh = (id: string) => {
  revalidatePath(`/operations/tasks/${id}`);
  revalidatePath("/operations", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/estate", "layout");
};

const done = (id: string, error: { code?: string; message?: string } | null, message: string) => {
  if (error) return fail(friendly(error));
  refresh(id);
  return ok(message);
};

// Subtasks and comments -----------------------------------------------------------

export async function addSubtask(taskId: string, title: string): Promise<ActionResult> {
  const { supabase, staff } = await staffOrThrow();
  const t = title.trim();
  if (!t) return fail("Write the subtask first.");
  const { error } = await supabase.from("task_subtasks").insert({ task_id: taskId, title: t, created_by: staff.id });
  return done(taskId, error, "Subtask added");
}

export async function setSubtask(taskId: string, id: string, isDone: boolean): Promise<ActionResult> {
  const { supabase } = await staffOrThrow();
  const { error } = await supabase.from("task_subtasks").update({ done: isDone }).eq("id", id);
  return done(taskId, error, "Saved");
}

export async function removeSubtask(taskId: string, id: string): Promise<ActionResult> {
  const { supabase } = await staffOrThrow();
  const { error } = await supabase.from("task_subtasks").delete().eq("id", id);
  return done(taskId, error, "Removed");
}

export async function addComment(taskId: string, body: string): Promise<ActionResult> {
  const { supabase, staff } = await staffOrThrow();
  const b = body.trim();
  if (!b) return fail("Write a comment first.");
  const { error } = await supabase.from("task_comments").insert({ task_id: taskId, author_id: staff.id, body: b });
  return done(taskId, error, "Comment added");
}

/** A team member's way to tell their lead: a note in the thread and a word on Slack. */
export async function notifyLead(taskId: string, note: string): Promise<ActionResult> {
  const { supabase, staff } = await staffOrThrow();
  const { data: task } = await supabase.from("tasks").select("id, title, division_id").eq("id", taskId).maybeSingle();
  if (!task) return fail("You can’t see this task.");
  const division = task.division_id ?? staff.division_id;
  const { data: leads } = division
    ? await supabase
        .from("team_members")
        .select("name")
        .in("role", ["lead", "community_manager"])
        .eq("division_id", division)
        .eq("status", "active")
    : { data: [] };
  const names = (leads ?? []).map((l) => l.name);
  const text = note.trim();
  const { error } = await supabase.from("task_comments").insert({
    task_id: taskId,
    author_id: staff.id,
    kind: "lead_ping",
    body: text || `${staff.name} asked their lead to look at this task.`,
  });
  if (error) return fail(friendly(error));
  notifyLater("task", (origin) => taskPingMessage({ id: taskId, title: task.title, by: staff.name, leads: names, note: text }, origin));
  refresh(taskId);
  return ok(names.length ? `Told ${names.join(", ")}` : "Noted. No lead is set for this division, so an admin will need to see it.");
}

// The on-site flow --------------------------------------------------------------------

export async function clockIn(taskId: string): Promise<ActionResult> {
  const { supabase } = await staffOrThrow();
  const { error } = await supabase.rpc("task_clock_in", { p_task: taskId });
  return done(taskId, error, "Clocked in");
}

export async function addPhotos(taskId: string, kind: "before" | "after", paths: string[]): Promise<ActionResult> {
  const { supabase } = await staffOrThrow();
  const { error } = await supabase.rpc("task_add_photos", { p_task: taskId, p_kind: kind, p_paths: paths });
  return done(taskId, error, paths.length === 1 ? "Photo added" : "Photos added");
}

export async function clockOut(taskId: string, finish: boolean): Promise<ActionResult> {
  const { supabase } = await staffOrThrow();
  const { error } = await supabase.rpc("task_clock_out", { p_task: taskId, p_finish: finish });
  return done(taskId, error, finish ? "Clocked out. Task done" : "Clocked out");
}

/** Forgot to clock out, or never clocked in: the real duration and the photos by hand. */
export async function logTime(
  taskId: string,
  hours: string,
  note: string,
  before: string[],
  after: string[],
  finish: boolean,
): Promise<ActionResult> {
  const { supabase } = await staffOrThrow();
  const minutes = parseHours(hours);
  if (!minutes) return fail("Enter how long you worked, like 1.5 or 1:30.");
  const { error } = await supabase.rpc("task_log_time", {
    p_task: taskId,
    p_minutes: minutes,
    p_note: note,
    p_before: before,
    p_after: after,
    p_finish: finish,
  });
  return done(taskId, error, "Time saved");
}

export async function addMaterial(taskId: string, _prev: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase } = await staffOrThrow();
  const name = field(data, "name");
  if (!name) return fail("Say what the material is.");
  const qty = Number(field(data, "quantity") ?? 1);
  if (!(qty > 0)) return fail("Enter a quantity.");
  const source = field(data, "source") === "bought" ? "bought" : "used";
  const amount = Number(field(data, "amount"));
  if (source === "bought" && !(amount > 0)) return fail("Enter what you paid.");
  const { error } = await supabase.rpc("add_task_material", {
    p_task: taskId,
    p_name: name,
    p_quantity: qty,
    p_unit: field(data, "unit"),
    p_source: source,
    p_amount: source === "bought" ? amount : null,
  });
  return done(taskId, error, "Material added");
}

export async function removeMaterial(taskId: string, id: string): Promise<ActionResult> {
  const { supabase } = await staffOrThrow();
  const { error } = await supabase.from("task_materials").delete().eq("id", id);
  return done(taskId, error, "Removed");
}

// Budget requests: leads ask, admins decide -------------------------------------------

export async function requestBudget(taskId: string, _prev: ActionResult, data: FormData): Promise<ActionResult> {
  const { supabase, staff } = await staffOrThrow();
  const amount = Number(field(data, "amount"));
  const reason = field(data, "reason");
  if (!(amount > 0)) return fail("Enter the amount you need.");
  if (!reason) return fail("Say what the money is for.");
  const { data: task } = await supabase.from("tasks").select("title").eq("id", taskId).maybeSingle();
  const { error } = await supabase
    .from("task_budget_requests")
    .insert({ task_id: taskId, amount, reason, requested_by: staff.id });
  if (error) return fail(friendly(error));
  notifyLater("task", (origin) =>
    budgetRequestMessage({ id: taskId, title: task?.title ?? "a task", by: staff.name, amount, reason }, origin),
  );
  refresh(taskId);
  return ok("Budget requested");
}

export async function reviewBudgetRequest(taskId: string, id: string, approve: boolean, comment: string): Promise<ActionResult> {
  const { supabase, staff } = await staffOrThrow();
  if (!isBudgetAdmin(staff)) return fail("Only an admin can decide a budget request.");
  const { error } = await supabase
    .from("task_budget_requests")
    .update({
      status: approve ? "approved" : "rejected",
      reviewed_by: staff.id,
      reviewed_at: new Date().toISOString(),
      review_comment: comment.trim() || null,
    })
    .eq("id", id)
    .eq("status", "requested");
  return done(taskId, error, approve ? "Approved" : "Declined");
}
