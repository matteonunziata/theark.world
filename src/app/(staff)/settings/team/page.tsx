import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { TeamView } from "./team-view";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const { supabase, staff } = await requireStaff("settings");
  const [{ data: team }, { data: divisions }] = await Promise.all([
    supabase.from("team_members").select("*").order("name"),
    supabase.from("divisions").select("*").order("name"),
  ]);
  return (
    <TeamView
      team={team ?? []}
      divisions={divisions ?? []}
      canEdit={staff.role === "admin"}
    />
  );
}
