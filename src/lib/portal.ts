import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { type Attendee } from "@/components/going";
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
  // "My Property" shows for members who own a lot.
  const ownsProperty = v.memberId ? ((await v.supabase.rpc("my_properties")).data ?? []).length > 0 : false;
  const list = cities ?? [];
  const home = list.find((c) => c.is_home) ?? list[0] ?? null;
  // The schedule is the home city's unless a member's record says otherwise.
  const city = list.find((c) => c.id === me?.city_id) ?? home;
  return {
    ...v,
    me,
    ownsProperty,
    cities: list,
    city,
    home,
    orgName: org?.name ?? "The ARK",
    timezone: org?.timezone ?? "America/Costa_Rica",
  };
});

export type PortalData = Awaited<ReturnType<typeof loadPortal>>;

/** Who's going, per session, for the cards: keyed `offeringId|date`. */
export async function loadGoing(p: PortalData, from: string, to: string) {
  const { data } = await p.supabase.rpc("portal_attendees", { p_from: from, p_to: to });
  const map = new Map<string, Attendee[]>();
  for (const a of data ?? []) {
    const k = `${a.offering_id}|${a.session_date}`;
    map.set(k, [...(map.get(k) ?? []), a]);
  }
  return map;
}
