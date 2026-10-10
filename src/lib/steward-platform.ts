import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getViewer } from "@/lib/auth";

/**
 * Everything the steward platform needs. Only an ACTIVE steward gets in, whether
 * or not they are a member; the database decides (`current_active_steward_id`).
 */
export const loadSteward = cache(async () => {
  const v = await getViewer();
  if (!v.user) redirect("/portal/login?next=/steward");
  if (!v.stewardId) redirect("/steward/closed");
  const [{ data: me }, { data: org }] = await Promise.all([
    v.supabase.rpc("my_steward_profile").maybeSingle(),
    v.supabase.rpc("public_org").maybeSingle(),
  ]);
  return {
    ...v,
    stewardId: v.stewardId,
    me,
    orgName: org?.name ?? "The ARK",
    timezone: org?.timezone ?? "America/Costa_Rica",
  };
});
