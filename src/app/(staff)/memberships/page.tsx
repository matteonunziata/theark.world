import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { MembersView } from "./members-view";

export const metadata: Metadata = { title: "Memberships" };

export default async function MembershipsPage() {
  const { supabase } = await requireStaff("memberships");
  const [{ data }, { data: tiers }, { data: org }] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, name, tier, location, interests, membership_status")
      .not("tier", "is", null)
      .eq("membership_status", "active")
      .order("name"),
    supabase.from("membership_tiers").select("key, name, spots").order("position"),
    supabase.from("org_settings").select("member_cap").single(),
  ]);
  const members = data ?? [];
  const n = (t: string) => members.filter((m) => m.tier === t).length;
  const capped = (tiers ?? []).filter((t) => t.spots);
  return (
    <>
      <div className="stats" style={{ marginBottom: 22 }}>
        <div className="stat">
          <b>{members.length}</b>
          <span>Active members{org?.member_cap ? `, of ${org.member_cap} for 2026` : ""}</span>
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
          <b>{n("standard") + n("annual")}</b>
          <span>Standard and annual</span>
        </div>
        <div className="stat">
          <b>{n("day") + n("week")}</b>
          <span>Day and week passes</span>
        </div>
      </div>
      <MembersView members={members} />
    </>
  );
}
