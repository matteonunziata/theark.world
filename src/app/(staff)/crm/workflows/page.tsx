import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";

export const metadata: Metadata = { title: "Workflows" };

export default async function WorkflowsPage() {
  const { supabase, staff } = await requireStaff("crm");
  const [{ data: workflows }, { data: active }] = await Promise.all([
    supabase.from("sequences").select("id, name, description, sequence_steps(position, channel, delay_days)").order("name"),
    supabase.from("enrollments").select("sequence_id").eq("status", "active"),
  ]);
  const canEdit = staff.role === "admin" || staff.role === "sales";
  const list = workflows ?? [];

  return (
    <>
      <div className="toolbar">
        <span className="muted">
          Email and WhatsApp follow-ups, step by step. Open one to see it as a
          flowchart and edit each stage. Enroll people from their profile.
        </span>
        <span className="count" />
        {canEdit && (
          <Link className="btn primary" href="/crm/workflows/new">
            New workflow
          </Link>
        )}
      </div>
      {!list.length ? (
        <div className="empty">
          <h2>No workflows yet</h2>
          <p>
            A workflow is a series of messages sent over days or weeks, like a
            waitlist welcome, an application nudge, or a land-buyer follow-up.
          </p>
          {canEdit && (
            <Link className="btn primary" href="/crm/workflows/new">
              New workflow
            </Link>
          )}
        </div>
      ) : (
        <div className="cards">
          {list.map((w) => {
            const steps = [...w.sequence_steps].sort((a, b) => a.position - b.position);
            const enrolled = (active ?? []).filter((e) => e.sequence_id === w.id).length;
            const days = steps.reduce((a, s) => a + s.delay_days, 0);
            return (
              <Link key={w.id} href={`/crm/workflows/${w.id}`} className="seq-card">
                <h3>{w.name}</h3>
                <p>
                  {w.description ? `${w.description} ` : ""}
                  {enrolled} enrolled · {steps.length} step{steps.length === 1 ? "" : "s"} over {days} day{days === 1 ? "" : "s"}.
                </p>
                <div className="wf-mini" aria-hidden="true">
                  <i className="start" />
                  {steps.map((s) => (
                    <span key={s.position}>
                      <em />
                      <i className={s.channel === "whatsapp" ? "wa" : s.channel === "call" ? "call" : ""} />
                    </span>
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
