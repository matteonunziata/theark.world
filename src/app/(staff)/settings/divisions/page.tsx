import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { DivisionsView } from "./divisions-view";

export const metadata: Metadata = { title: "Divisions" };

export default async function DivisionsPage() {
  const { supabase, staff } = await requireStaff("settings");
  const [{ data: divisions }, { data: team }] = await Promise.all([
    supabase.from("divisions").select("*").order("name"),
    supabase
      .from("team_members")
      .select("id, name, division_id, status")
      .order("name"),
  ]);
  return (
    <DivisionsView
      divisions={divisions ?? []}
      team={team ?? []}
      canEdit={staff.role === "admin"}
    />
  );
}
