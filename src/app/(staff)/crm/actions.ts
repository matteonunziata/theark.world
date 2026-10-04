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
import { CHANNELS, MSTATUS, PIPELINES, PTYPES, TIERS } from "@/lib/crm";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const refresh = () => {
  revalidatePath("/crm", "layout");
  revalidatePath("/memberships", "layout");
};

export async function saveContact(
  _prev: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  const { supabase, staff } = await staffOrThrow("admin", "sales");
  const id = field(data, "id");

  if (data.get("intent") === "delete" && id) {
    const { error } = await supabase.from("contacts").delete().eq("id", id);
    if (error) return fail(friendly(error));
    refresh();
    return ok("Deleted");
  }

  const name = field(data, "name");
  const email = field(data, "email")?.toLowerCase() ?? null;
  const type = field(data, "type") ?? "contact";
  const tier = field(data, "tier");
  const status = field(data, "membership_status") ?? "active";
  if (!name) return fail("Enter a name.");
  if (email && !EMAIL.test(email)) return fail("Enter a valid email.");
  if (!PTYPES.some((t) => t[0] === type)) return fail("Choose a type.");
  if (tier && !TIERS.some((t) => t[0] === tier)) return fail("Choose a tier.");
  if (!MSTATUS.some((m) => m[0] === status)) return fail("Choose a status.");

  // Sales own what they add; only admins hand contacts to someone else.
  const isAdmin = staff.role === "admin";

  const row = {
    name,
    email,
    type,
    tier,
    membership_status: status,
    phone: field(data, "phone"),
    instagram: field(data, "instagram"),
    location: field(data, "location"),
    source: field(data, "source"),
    interests: (field(data, "interests") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    member_since: field(data, "member_since"),
    renews_on: field(data, "renews_on"),
    lot: field(data, "lot"),
    resident: data.get("resident") === "yes",
    ...(isAdmin ? { owner_id: field(data, "owner_id") } : {}),
  };

  if (id) {
    const { error } = await supabase.from("contacts").update(row).eq("id", id);
    if (error) {
      if (error.code === "23505") return fail("Someone already has that email.");
      return fail(friendly(error));
    }
    refresh();
    return ok("Changes saved");
  }
  const { error } = await supabase
    .from("contacts")
    .insert({
      ...row,
      owner_id: isAdmin ? field(data, "owner_id") : staff.id,
      created_by: staff.id,
    });
  if (error) {
    if (error.code === "23505") return fail("Someone already has that email.");
    return fail(friendly(error));
  }
  refresh();
  return ok(`${name} added`);
}

export async function addNote(contactId: string, body: string) {
  const { supabase, staff } = await staffOrThrow("admin", "sales");
  const text = body.trim();
  if (!text) return fail("Write a note first.");
  const { error } = await supabase
    .from("contact_notes")
    .insert({ contact_id: contactId, body: text, author_id: staff.id });
  if (error) return fail(friendly(error));
  refresh();
  return ok("Note added");
}

export async function setStage(
  contactId: string,
  pipeline: string,
  stage: string | null,
) {
  const { supabase } = await staffOrThrow("admin", "sales");
  const p = PIPELINES[pipeline as keyof typeof PIPELINES];
  if (!p) return fail("Unknown pipeline.");
  const { error } = stage
    ? p.stages.some(([k]) => k === stage)
      ? await supabase
          .from("contact_stages")
          .upsert({ contact_id: contactId, pipeline, stage })
      : { error: { message: "Unknown stage." } }
    : await supabase
        .from("contact_stages")
        .delete()
        .eq("contact_id", contactId)
        .eq("pipeline", pipeline);
  if (error) return fail(friendly(error));
  refresh();
  return ok(stage ? "Stage updated" : "Removed from pipeline");
}

export async function enroll(contactId: string, sequenceId: string) {
  const { supabase } = await staffOrThrow("admin", "sales");
  const { error } = await supabase
    .from("enrollments")
    .insert({ contact_id: contactId, sequence_id: sequenceId });
  if (error) {
    if (error.code === "23505") return fail("Already enrolled in that sequence.");
    return fail(friendly(error));
  }
  refresh();
  return ok("Enrolled");
}

export async function updateEnrollment(
  enrollmentId: string,
  act: "stop" | "remove",
) {
  const { supabase } = await staffOrThrow("admin", "sales");
  const { error } =
    act === "remove"
      ? await supabase.from("enrollments").delete().eq("id", enrollmentId)
      : await supabase
          .from("enrollments")
          .update({ status: "stopped" })
          .eq("id", enrollmentId);
  if (error) return fail(friendly(error));
  refresh();
  return ok(act === "remove" ? "Removed" : "Stopped");
}

export async function markSent(enrollmentId: string, step: number) {
  const { supabase, staff } = await staffOrThrow("admin", "sales");
  const { error } = await supabase.from("enrollment_sends").upsert({
    enrollment_id: enrollmentId,
    step_position: step,
    sent_by: staff.id,
  });
  if (error) return fail(friendly(error));

  // Complete the enrollment once every step is sent.
  const { data: e } = await supabase
    .from("enrollments")
    .select("sequence_id, enrollment_sends(step_position)")
    .eq("id", enrollmentId)
    .single();
  if (e) {
    const { count } = await supabase
      .from("sequence_steps")
      .select("id", { count: "exact", head: true })
      .eq("sequence_id", e.sequence_id);
    if (count && e.enrollment_sends.length >= count) {
      await supabase
        .from("enrollments")
        .update({ status: "completed" })
        .eq("id", enrollmentId);
    }
  }
  refresh();
  return ok("Marked as sent");
}

export async function saveSequence(
  _prev: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin", "sales");
  const id = field(data, "id");

  if (data.get("intent") === "delete" && id) {
    const { error } = await supabase.from("sequences").delete().eq("id", id);
    if (error) return fail(friendly(error));
    refresh();
    return ok("Sequence deleted");
  }

  const name = field(data, "name");
  if (!name) return fail("Enter a name.");
  const channels = data.getAll("s_channel").map(String);
  const delays = data.getAll("s_delay").map(String);
  const subjects = data.getAll("s_subject").map(String);
  const bodies = data.getAll("s_body").map(String);
  const steps = channels
    .map((c, i) => ({
      channel: CHANNELS.some(([k]) => k === c) ? c : "email",
      delay_days: Math.max(0, Number(delays[i] || 0)),
      subject: subjects[i]?.trim() ?? "",
      body: bodies[i]?.trim() ?? "",
    }))
    .filter((s) => s.body);
  if (!steps.length) return fail("Add at least one step with a message.");

  const { error } = await supabase.rpc("save_sequence", {
    p_id: id,
    p_name: name,
    p_description: field(data, "description"),
    p_steps: steps,
  });
  if (error) return fail(friendly(error));
  refresh();
  return ok(id ? "Sequence saved" : "Sequence created");
}
