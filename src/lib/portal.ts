import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getViewer } from "@/lib/auth";

/** Everything the portal shell needs: who's looking, and the club's home city. */
export const loadPortal = cache(async () => {
  const v = await getViewer();
  if (!v.user) redirect("/portal/login");
  if (!v.memberId && !v.staff) redirect("/no-access");
  const { supabase } = v;
  const [{ data: me }, { data: cities }, { data: org }] = await Promise.all([
    v.memberId ? supabase.rpc("my_member_profile").maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("cities").select("*").eq("active", true).order("position").order("name"),
    supabase.rpc("public_org").maybeSingle(),
  ]);
  const list = cities ?? [];
  const home = list.find((c) => c.is_home) ?? list[0] ?? null;
  // The schedule is the home city's unless a member's record says otherwise.
  const city = list.find((c) => c.id === me?.city_id) ?? home;
  return {
    ...v,
    me,
    cities: list,
    city,
    home,
    orgName: org?.name ?? "The ARK",
    timezone: org?.timezone ?? "America/Costa_Rica",
  };
});

export type PortalData = Awaited<ReturnType<typeof loadPortal>>;
