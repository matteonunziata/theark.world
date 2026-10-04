import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { ROLES } from "@/lib/roles";

export const metadata: Metadata = { title: "Access levels" };

export default async function AccessPage() {
  const { supabase } = await requireStaff("settings");
  const { data: team } = await supabase
    .from("team_members")
    .select("role")
    .eq("status", "active");
  return (
    <>
      <div className="roles">
        {ROLES.map((r) => {
          const n = (team ?? []).filter((m) => m.role === r.key).length;
          return (
            <div className="role" key={r.key}>
              <b>{r.name}</b>
              <span className="d muted">{r.desc}</span>
              <span className="n">
                {n} {n === 1 ? "person" : "people"}
              </span>
            </div>
          );
        })}
      </div>
      <p className="note">
        Access is enforced by the database, not just this screen. Finance is
        visible to admins only. Only @theark.world Google accounts added to the
        team can sign in.
      </p>
    </>
  );
}
