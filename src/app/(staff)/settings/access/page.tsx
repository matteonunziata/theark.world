import type { Metadata } from "next";
import { getRoleAccess, requireStaff } from "@/lib/auth";
import { AccessView } from "./access-view";

export const metadata: Metadata = { title: "Access levels" };

export default async function AccessPage() {
  const { supabase, staff } = await requireStaff("settings");
  const { data: team } = await supabase
    .from("team_members")
    .select("role")
    .eq("status", "active");
  const counts: Record<string, number> = {};
  for (const m of team ?? []) counts[m.role] = (counts[m.role] ?? 0) + 1;
  return (
    <>
      <AccessView
        counts={counts}
        saved={(await getRoleAccess()) as Record<string, string[]>}
        canEdit={staff.role === "admin"}
      />
      <p className="note">
        Admins see every page. The database still decides what each person can
        read or change inside a page. Finance is visible to admins and anyone
        with a finance role. Only people added to the team can sign in.
      </p>
    </>
  );
}
