import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { TeamView } from "./team-view";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const { supabase, staff } = await requireStaff("settings");
  const [{ data: team }, { data: divisions }, { data: rates }] = await Promise.all([
    supabase.from("team_members").select("*").order("name"),
    supabase.from("divisions").select("*").order("name"),
    supabase.from("staff_rates").select("staff_id, pay_rate, bill_rate"),
  ]);
  return (
    <TeamView
      team={team ?? []}
      divisions={divisions ?? []}
      rates={rates ?? []}
      canEdit={staff.role === "admin"}
    />
  );
}
