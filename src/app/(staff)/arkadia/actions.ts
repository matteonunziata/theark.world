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
import { schoolOrThrow } from "@/lib/auth";

const refresh = (id?: string | null) => {
  revalidatePath("/arkadia");
  if (id) revalidatePath(`/arkadia/${id}`);
};

export async function saveStudent(
  _prev: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  const { supabase } = await schoolOrThrow();
  const id = field(data, "id");

  if (data.get("intent") === "delete" && id) {
    const { error } = await supabase.from("students").delete().eq("id", id);
    if (error) return fail(friendly(error));
    revalidatePath("/arkadia");
    redirect("/arkadia");
  }

  const name = field(data, "name");
  if (!name) return fail("Enter the student’s name.");
  const row = {
    name,
    preferred_name: field(data, "preferred_name"),
    birthdate: field(data, "birthdate"),
    group_name: field(data, "group_name"),
    photo_path: field(data, "photo_path"),
    about: field(data, "about"),
    staff_notes: field(data, "staff_notes"),
    start_date: field(data, "start_date"),
    status: field(data, "status") === "alumni" ? "alumni" : "active",
  };
  if (id) {
    const { error } = await supabase.from("students").update(row).eq("id", id);
    if (error) return fail(friendly(error));
    refresh(id);
    return ok("Profile saved");
  }
  const { data: s, error } = await supabase
    .from("students")
    .insert(row)
    .select("id")
    .single();
  if (error) return fail(friendly(error));

  // Parents entered with the student.
  const parent = field(data, "parent_name");
  if (parent) {
    await supabase.from("student_guardians").insert({
      student_id: s.id,
      name: parent,
      relation: field(data, "parent_relation"),
      email: field(data, "parent_email"),
      phone: field(data, "parent_phone"),
    });
  }
  refresh();
  return ok(`${name} added`);
}

export async function saveGuardian(
  _prev: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  const { supabase } = await schoolOrThrow();
  const id = field(data, "id");
  const studentId = field(data, "student_id");
  if (data.get("intent") === "delete" && id) {
    const { error } = await supabase.from("student_guardians").delete().eq("id", id);
    if (error) return fail(friendly(error));
    refresh(studentId);
    return ok("Removed");
  }
  const name = field(data, "name");
  if (!name || !studentId) return fail("Enter a name.");
  const email = field(data, "email");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("That email doesn’t look right.");
  const row = {
    name,
    relation: field(data, "relation"),
    email,
    phone: field(data, "phone"),
  };
  const { error } = id
    ? await supabase.from("student_guardians").update(row).eq("id", id)
    : await supabase.from("student_guardians").insert({ ...row, student_id: studentId });
  if (error) return fail(friendly(error));
  refresh(studentId);
  return ok(id ? "Saved" : `${name} added`);
}

export async function postUpdate(
  _prev: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  const { supabase, staff } = await schoolOrThrow();
  const studentId = field(data, "student_id");
  const body = field(data, "body");
  if (!studentId) return fail("Pick a student.");
  if (!body) return fail("Write something first.");
  const { error } = await supabase.from("student_updates").insert({
    student_id: studentId,
    author_id: staff.id,
    body,
    photo_path: field(data, "photo_path"),
    shared: data.get("shared") === "on",
  });
  if (error) return fail(friendly(error));
  refresh(studentId);
  return ok(data.get("shared") === "on" ? "Shared with the family" : "Saved as a staff note");
}

export async function deleteUpdate(id: string, studentId: string): Promise<ActionResult> {
  const { supabase } = await schoolOrThrow();
  const { error } = await supabase.from("student_updates").delete().eq("id", id);
  if (error) return fail(friendly(error));
  refresh(studentId);
  return ok("Update deleted");
}

export async function toggleShared(id: string, studentId: string, shared: boolean): Promise<ActionResult> {
  const { supabase } = await schoolOrThrow();
  const { error } = await supabase.from("student_updates").update({ shared }).eq("id", id);
  if (error) return fail(friendly(error));
  refresh(studentId);
  return ok(shared ? "Now visible to the family" : "Hidden from the family");
}

/** Make a new family link; the old one stops working. */
export async function newFamilyLink(studentId: string): Promise<ActionResult> {
  const { supabase } = await schoolOrThrow();
  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const { error } = await supabase
    .from("students")
    .update({ share_token: token })
    .eq("id", studentId);
  if (error) return fail(friendly(error));
  refresh(studentId);
  return ok("New link made. The old one no longer works.");
}
