import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { PipelineBoard } from "./pipeline-board";

export const metadata: Metadata = { title: "Pipelines" };

export default async function PipelinesPage() {
  const { supabase, staff } = await requireStaff("crm");
  const [{ data: contacts }, { data: stages }] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, name, tier, location, source, lot")
      .order("name"),
    supabase.from("contact_stages").select("contact_id, pipeline, stage"),
  ]);
  return (
    <PipelineBoard
      contacts={contacts ?? []}
      stages={stages ?? []}
      canEdit={staff.role === "admin" || staff.role === "sales"}
    />
  );
}
