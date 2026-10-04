import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { nextStep, stepDue } from "@/lib/sequences";
import { QueueView } from "./queue-view";

export const metadata: Metadata = { title: "Send queue" };

export default async function QueuePage() {
  const { supabase, staff } = await requireStaff("crm");
  const [{ data: enrollments }, { data: org }] = await Promise.all([
    supabase
      .from("enrollments")
      .select(
        "id, sequence_id, started_on, status, enrollment_sends(step_position), contact:contacts(id, name, email, phone, tier), sequence:sequences(id, name, sequence_steps(*))",
      )
      .eq("status", "active"),
    supabase.rpc("public_org").maybeSingle(),
  ]);
  const today = todayIn();
  const items = (enrollments ?? [])
    .flatMap((e) => {
      if (!e.contact || !e.sequence) return [];
      const steps = [...e.sequence.sequence_steps].sort((a, b) => a.position - b.position);
      const sent = e.enrollment_sends.map((s) => s.step_position);
      const i = nextStep(steps, sent);
      if (i === -1) return [];
      const due = stepDue(e.started_on, steps, i);
      if (due > today) return [];
      return [
        {
          due,
          i,
          contact: e.contact,
          seq: { id: e.sequence.id, name: e.sequence.name, steps },
          e: {
            id: e.id,
            sequence_id: e.sequence_id,
            started_on: e.started_on,
            status: e.status,
            sent,
          },
        },
      ];
    })
    .sort((a, b) => a.due.localeCompare(b.due));
  return (
    <QueueView
      items={items}
      today={today}
      orgName={org?.name ?? "The ARK"}
      canEdit={staff.role === "admin" || staff.role === "sales"}
    />
  );
}
