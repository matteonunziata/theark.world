import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { SequencesView } from "./sequences-view";

export const metadata: Metadata = { title: "Sequences" };

export default async function SequencesPage() {
  const { supabase, staff } = await requireStaff("crm");
  const [{ data: sequences }, { data: active }] = await Promise.all([
    supabase
      .from("sequences")
      .select("id, name, description, sequence_steps(*)")
      .order("name"),
    supabase.from("enrollments").select("sequence_id").eq("status", "active"),
  ]);
  return (
    <SequencesView
      sequences={(sequences ?? []).map((s) => ({
        ...s,
        steps: [...s.sequence_steps].sort((a, b) => a.position - b.position),
        enrolled: (active ?? []).filter((e) => e.sequence_id === s.id).length,
      }))}
      canEdit={staff.role === "admin" || staff.role === "sales"}
    />
  );
}
