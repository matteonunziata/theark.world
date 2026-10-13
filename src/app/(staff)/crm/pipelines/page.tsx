import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { getPipelines } from "@/lib/pipelines";
import { PipelineBoard } from "./pipeline-board";

export const metadata: Metadata = { title: "Pipelines" };

export default async function PipelinesPage() {
  const { supabase, staff } = await requireStaff("crm");
  const [{ data: contacts }, { data: stages }, pipelines] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, name, tier, location, source, lot, visit_date, tafo_choice")
      .order("name"),
    supabase.from("contact_stages").select("contact_id, pipeline, stage"),
    getPipelines(supabase),
  ]);
  return (
    <PipelineBoard
      contacts={contacts ?? []}
      stages={stages ?? []}
      pipelines={pipelines}
      isAdmin={staff.role === "admin"}
      canEdit={staff.role === "admin" || staff.role === "sales"}
    />
  );
}
