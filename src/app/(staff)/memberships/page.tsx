import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { MembersView } from "./members-view";

export const metadata: Metadata = { title: "Memberships" };

const isPass = (period: string | undefined) => period === "day" || period === "week";

export default async function MembershipsPage() {
  const { supabase } = await requireStaff("memberships");
  const today = todayIn();
  const [{ data: rows }, { data: tiers }, { data: org }] = await Promise.all([
    supabase
      .from("memberships")
      .select("id, tier, status, starts_on, ends_on, activate_by, contact:contacts(id, name, location, interests)")
      .neq("status", "revoked")
      .or(`ends_on.is.null,ends_on.gte.${today}`),
    supabase.from("membership_tiers").select("key, name, spots, period").order("position"),
    supabase.from("org_settings").select("member_cap").single(),
  ]);
  const period = (key: string) => tiers?.find((t) => t.key === key)?.period;
  // One card per person: whoever holds a membership that covers today (or
  // starts later), and pass holders with a pass still to use or in use.
  const covering = (rows ?? []).filter(
    (m) =>
      m.contact &&
      ((m.status === "unused" && (m.activate_by ?? "") >= today) ||
        (m.status !== "unused" && !!m.starts_on && (m.ends_on === null || m.ends_on >= today))),
  );
  const seen = new Set<string>();
  const members = covering
    .filter((m) => !isPass(period(m.tier)) && m.starts_on! <= today)
    .map((m) => ({ ...m.contact!, tier: m.tier as string | null }))
    .filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
  const upcoming = covering.filter((m) => !isPass(period(m.tier)) && m.starts_on! > today && !seen.has(m.contact!.id)).length;
  const passes = covering.filter((m) => isPass(period(m.tier)));
  const n = (t: string) => members.filter((m) => m.tier === t).length;
  const capped = (tiers ?? []).filter((t) => t.spots);
  return (
    <>
      <div className="stats" style={{ marginBottom: 22 }}>
        <div className="stat">
          <b>{members.length}</b>
          <span>
            Active members{org?.member_cap ? `, of ${org.member_cap} for 2026` : ""}
            {upcoming ? `, ${upcoming} starting later` : ""}
          </span>
        </div>
        {capped.map((t) => (
          <div className="stat" key={t.key}>
            <b>{n(t.key)}</b>
            <span>
              {t.name}, of {t.spots} spots
            </span>
          </div>
        ))}
        <div className="stat">
          <b>{n("standard") + n("annual") + n("quarter") + n("half")}</b>
          <span>Monthly and longer terms</span>
        </div>
        <div className="stat">
          <b>{passes.filter((m) => m.status !== "unused").length}</b>
          <span>
            Passes in use{passes.some((m) => m.status === "unused") ? `, ${passes.filter((m) => m.status === "unused").length} bought and not used yet` : ""}
          </span>
        </div>
      </div>
      <MembersView members={members} />
    </>
  );
}
