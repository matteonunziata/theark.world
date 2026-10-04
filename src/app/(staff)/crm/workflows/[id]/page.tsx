import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { aiEnabled } from "@/lib/ai";
import { requireStaff } from "@/lib/auth";
import { nextStep } from "@/lib/sequences";
import { WorkflowEditor } from "./workflow-editor";

type Props = PageProps<"/crm/workflows/[id]">;

const UUID = /^[0-9a-f-]{36}$/;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (id === "new") return { title: "New workflow" };
  const { supabase } = await requireStaff("crm");
  const { data } = UUID.test(id)
    ? await supabase.from("sequences").select("name").eq("id", id).maybeSingle()
    : { data: null };
  return { title: data?.name ?? "Workflow" };
}

export default async function WorkflowPage({ params }: Props) {
  const { id } = await params;
  const { supabase, staff } = await requireStaff("crm");
  const canEdit = staff.role === "admin" || staff.role === "sales";
  const { data: org } = await supabase.rpc("public_org").maybeSingle();

  if (id === "new") {
    return (
      <WorkflowEditor
        workflow={null}
        stats={{ waiting: [], completed: 0, active: 0 }}
        canEdit={canEdit}
        orgName={org?.name ?? "The ARK"}
        aiOn={aiEnabled()}
      />
    );
  }
  if (!UUID.test(id)) notFound();

  const [{ data: w }, { data: enrollments }] = await Promise.all([
    supabase.from("sequences").select("id, name, description, sequence_steps(*)").eq("id", id).maybeSingle(),
    supabase
      .from("enrollments")
      .select("status, enrollment_sends(step_position)")
      .eq("sequence_id", id),
  ]);
  if (!w) notFound();
  const steps = [...w.sequence_steps].sort((a, b) => a.position - b.position);

  // How many people are waiting at each step right now.
  const waiting = steps.map(() => 0);
  let completed = 0;
  let active = 0;
  for (const e of enrollments ?? []) {
    if (e.status === "completed") completed++;
    if (e.status !== "active") continue;
    active++;
    const i = nextStep(steps, e.enrollment_sends.map((s) => s.step_position));
    if (i >= 0) waiting[i]++;
  }

  return (
    <WorkflowEditor
      workflow={{ id: w.id, name: w.name, description: w.description, steps }}
      stats={{ waiting, completed, active }}
      canEdit={canEdit}
      orgName={org?.name ?? "The ARK"}
      aiOn={aiEnabled()}
    />
  );
}
