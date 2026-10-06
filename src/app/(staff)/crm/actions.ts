"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import {
  type ActionResult,
  fail,
  field,
  friendly,
  ok,
} from "@/lib/action-result";
import { staffOrThrow } from "@/lib/auth";
import { CHANNELS, merge, MSTATUS, PIPELINES, PTYPES } from "@/lib/crm";
import { aiEnabled, draftStep, draftWorkflow } from "@/lib/ai";
import { sendWorkflowEmail } from "@/lib/email";
import { IMPORT_MAX, type ImportRow } from "@/lib/csv";
import { pushContact } from "@/lib/ghl";
import { createAdminClient } from "@/lib/supabase/admin";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const refresh = () => {
  revalidatePath("/crm", "layout");
  revalidatePath("/memberships", "layout");
};

// After a save, send the person to GHL (Settings → Integrations) once the
// response is out. Needs the service role key; without it the daily sync
// and "Sync now" catch up.
const syncOut = (contactId: string) =>
  after(async () => {
    const admin = createAdminClient();
    if (!admin) return;
    await pushContact(admin, contactId).catch(() => {});
  });

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
  if (!MSTATUS.some((m) => m[0] === status)) return fail("Choose a status.");

  // Sales own what they add; only admins hand contacts to someone else.
  const isAdmin = staff.role === "admin";

  const row = {
    name,
    email,
    type,
    tier,
    membership_status: status,
    rate: field(data, "rate") === "ff" ? "ff" : "rack",
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
    discount_id: field(data, "discount_id"),
    ...(isAdmin ? { owner_id: field(data, "owner_id") } : {}),
  };

  if (id) {
    const { error } = await supabase.from("contacts").update(row).eq("id", id);
    if (error) {
      if (error.code === "23505") return fail("Someone already has that email.");
      return fail(friendly(error));
    }
    refresh();
    syncOut(id);
    return ok("Changes saved");
  }
  const { data: created, error } = await supabase
    .from("contacts")
    .insert({
      ...row,
      owner_id: isAdmin ? field(data, "owner_id") : staff.id,
      created_by: staff.id,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return fail("Someone already has that email.");
    return fail(friendly(error));
  }
  refresh();
  if (created) syncOut(created.id);
  return ok(`${name} added`);
}

/**
 * Add contacts from a CSV the browser already parsed (see lib/csv). People
 * whose email is already in the CRM are left as they are.
 */
export async function importContacts(
  _prev: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  const { supabase, staff } = await staffOrThrow("admin", "sales");
  let rows: ImportRow[];
  try {
    rows = JSON.parse(String(data.get("rows") ?? "[]"));
  } catch {
    return fail("Couldn’t read that file. Try exporting it again as CSV.");
  }
  if (!Array.isArray(rows) || !rows.length) return fail("There’s no one to add.");
  if (rows.length > IMPORT_MAX) {
    return fail(`Up to ${IMPORT_MAX.toLocaleString()} people at a time. Split the file and import each part.`);
  }
  const fallbackType = field(data, "type") ?? "contact";
  if (!PTYPES.some((t) => t[0] === fallbackType)) return fail("Choose a type.");
  const fallbackSource = field(data, "source")?.slice(0, 120) ?? "CSV import";
  const str = (v: unknown, max = 200) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

  const clean = rows
    .map((r) => {
      const email = str(r.email)?.toLowerCase() ?? null;
      return {
        name: str(r.name),
        email: email && EMAIL.test(email) ? email : null,
        phone: str(r.phone, 60),
        instagram: str(r.instagram, 80),
        location: str(r.location),
        source: str(r.source, 120) ?? fallbackSource,
        interests: Array.isArray(r.interests)
          ? r.interests.map((s) => str(s, 60)).filter((s): s is string => !!s).slice(0, 20)
          : [],
        type: PTYPES.some((t) => t[0] === r.type) ? (r.type as string) : fallbackType,
        note: str(r.note, 4000),
      };
    })
    .filter((r): r is typeof r & { name: string } => !!r.name);

  // Skip anyone already in the CRM (emails are case-insensitive in the table).
  const emails = clean.flatMap((r) => (r.email ? [r.email] : []));
  const existing = new Set<string>();
  for (let i = 0; i < emails.length; i += 200) {
    const { data: found, error } = await supabase
      .from("contacts")
      .select("email")
      .in("email", emails.slice(i, i + 200));
    if (error) return fail(friendly(error));
    for (const f of found ?? []) if (f.email) existing.add(String(f.email).toLowerCase());
  }
  const fresh = clean.filter((r) => !r.email || !existing.has(r.email));

  let added = 0;
  for (let i = 0; i < fresh.length; i += 250) {
    const chunk = fresh.slice(i, i + 250);
    const { data: inserted, error } = await supabase
      .from("contacts")
      .insert(
        chunk.map((r) => ({
          name: r.name,
          email: r.email,
          phone: r.phone,
          instagram: r.instagram,
          location: r.location,
          source: r.source,
          interests: r.interests,
          type: r.type,
          owner_id: staff.id,
          created_by: staff.id,
        })),
      )
      .select("id");
    if (error) {
      if (added) refresh();
      const what = error.code === "23505" ? "Someone in the file was just added by someone else." : friendly(error);
      return fail(added ? `Added ${added}, then stopped: ${what}` : what);
    }
    added += inserted.length;
    const notes = chunk.flatMap((r, j) =>
      r.note && inserted[j] ? [{ contact_id: inserted[j].id, body: r.note, author_id: staff.id }] : [],
    );
    if (notes.length) await supabase.from("contact_notes").insert(notes);
  }

  refresh();
  const skipped = clean.length - fresh.length;
  const parts = [`Added ${added} ${added === 1 ? "person" : "people"}`];
  if (skipped) parts.push(`${skipped} already in the CRM`);
  return ok(parts.join(", "));
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
    if (error.code === "23505") return fail("Already enrolled in that workflow.");
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

/** Send an email step in the ARK template, then mark it sent. */
export async function sendStep(enrollmentId: string, step: number) {
  const { supabase } = await staffOrThrow("admin", "sales");
  const { data: e } = await supabase
    .from("enrollments")
    .select("sequence_id, contacts(name, email)")
    .eq("id", enrollmentId)
    .single();
  if (!e?.contacts?.email) return fail("There’s no email on file for this person.");
  const [{ data: st }, { data: org }] = await Promise.all([
    supabase
      .from("sequence_steps")
      .select("subject, body, channel")
      .eq("sequence_id", e.sequence_id)
      .eq("position", step)
      .single(),
    supabase.rpc("public_org").maybeSingle(),
  ]);
  if (!st || st.channel !== "email") return fail("That step isn’t an email.");
  const orgName = org?.name ?? "The ARK";
  const sent = await sendWorkflowEmail({
    to: e.contacts.email,
    subject: merge(st.subject, e.contacts, orgName),
    body: merge(st.body, e.contacts, orgName),
    orgName,
  });
  if (!sent) {
    return fail("Email isn’t set up yet (Resend). Open it in your email app instead.");
  }
  const marked = await markSent(enrollmentId, step);
  return marked.ok ? ok("Sent") : marked;
}

export type WorkflowStep = {
  channel: string;
  delay_days: number;
  subject: string | null;
  body: string;
};

/** Save a workflow and its steps from the flowchart editor. */
export async function saveWorkflow(input: {
  id: string | null;
  name: string;
  description: string | null;
  steps: WorkflowStep[];
}): Promise<ActionResult & { id?: string }> {
  const { supabase } = await staffOrThrow("admin", "sales");
  const name = input.name.trim();
  if (!name) return fail("Give the workflow a name.");
  const steps = input.steps.map((s) => ({
    channel: CHANNELS.some(([k]) => k === s.channel) ? s.channel : "email",
    delay_days: Math.max(0, Math.floor(Number(s.delay_days) || 0)),
    subject: s.subject?.trim() ?? "",
    body: s.body.trim(),
  }));
  const empty = steps.findIndex((s) => !s.body);
  if (!steps.length) return fail("Add at least one step.");
  if (empty >= 0) return fail(`Step ${empty + 1} has no message yet.`);
  const { data, error } = await supabase.rpc("save_sequence", {
    p_id: input.id,
    p_name: name,
    p_description: input.description?.trim() || null,
    p_steps: steps,
  });
  if (error) return fail(friendly(error));
  refresh();
  revalidatePath(`/crm/workflows/${data}`);
  return { ...ok(input.id ? "Workflow saved" : "Workflow created"), id: data ?? undefined };
}

export async function deleteWorkflow(id: string): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin", "sales");
  const { error } = await supabase.from("sequences").delete().eq("id", id);
  if (error) return fail(friendly(error));
  refresh();
  return ok("Workflow deleted");
}

/** AI: draft or change a whole workflow. The editor shows the result unsaved. */
export async function aiDraftWorkflow(input: {
  request: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
}): Promise<ActionResult & { workflow?: { name: string; description: string; steps: WorkflowStep[] } }> {
  await staffOrThrow("admin", "sales");
  if (!aiEnabled()) return fail("AI isn’t switched on yet. Add an Anthropic API key (ANTHROPIC_API_KEY) to turn it on.");
  if (!input.request.trim()) return fail("Say what you’d like the workflow to do.");
  try {
    const w = await draftWorkflow({
      ...input,
      steps: input.steps.map((s) => ({
        channel: s.channel === "whatsapp" || s.channel === "call" ? s.channel : "email",
        delay_days: s.delay_days,
        subject: s.subject ?? "",
        body: s.body,
      })),
    });
    return {
      ...ok("Drafted. Check it, then save."),
      workflow: {
        ...w,
        steps: w.steps.slice(0, 20).map((s) => ({ ...s, delay_days: Math.min(365, Math.max(0, s.delay_days)) })),
      },
    };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/** AI: write or rewrite one step. */
export async function aiDraftStep(input: Parameters<typeof draftStep>[0]): Promise<ActionResult & { subject?: string; body?: string }> {
  await staffOrThrow("admin", "sales");
  if (!aiEnabled()) return fail("AI isn’t switched on yet. Add an Anthropic API key (ANTHROPIC_API_KEY) to turn it on.");
  if (!input.request.trim()) return fail("Say what you’d like this message to say or do.");
  try {
    const m = await draftStep(input);
    return { ...ok("Drafted. Check it, then save."), subject: m.subject, body: m.body };
  } catch (e) {
    return fail((e as Error).message);
  }
}
