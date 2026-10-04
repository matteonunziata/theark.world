import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Tables } from "@/lib/database.types";
import { canSee, type ModuleKey } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export type Staff = Tables<"team_members">;

/** The signed-in person: staff record, member contact, or neither. */
export const getViewer = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, staff: null, memberId: null };

  const [{ data: staff }, { data: memberId }] = await Promise.all([
    supabase
      .from("team_members")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle(),
    supabase.rpc("current_member_contact_id"),
  ]);
  return {
    supabase,
    user,
    staff,
    memberId: memberId ?? null,
  };
});

/** For staff pages: redirect anyone who isn't active staff. */
export async function requireStaff(module?: ModuleKey) {
  const v = await getViewer();
  if (!v.user) redirect("/login");
  if (!v.staff) redirect(v.memberId ? "/portal" : "/no-access");
  if (module && !canSee(v.staff.role, module)) redirect("/");
  return { ...v, staff: v.staff };
}

/** For server actions: throw instead of redirecting. */
export async function staffOrThrow(...roles: string[]) {
  const v = await getViewer();
  if (!v.staff) throw new Error("You need to be signed in as staff.");
  if (roles.length && !roles.includes(v.staff.role)) {
    throw new Error("You don’t have access to do that.");
  }
  return { ...v, staff: v.staff };
}

/** Arkadia pages: admins and people in the school division. */
export async function requireSchool() {
  const v = await requireStaff();
  const { data } = await v.supabase.rpc("is_school_staff");
  if (!data) redirect("/");
  return v;
}

export async function schoolOrThrow() {
  const v = await staffOrThrow();
  const { data } = await v.supabase.rpc("is_school_staff");
  if (!data) throw new Error("You don’t have access to Arkadia.");
  return v;
}
