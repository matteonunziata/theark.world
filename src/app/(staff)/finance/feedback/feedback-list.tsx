"use client";

import { useTransition } from "react";
import { useToast } from "@/components/toast";
import { fmtStamp } from "@/lib/budgets";
import type { Tables } from "@/lib/database.types";
import { deleteFeedback } from "../budgets/actions";

export function FeedbackList({
  feedback,
  divisions,
}: {
  feedback: Tables<"finance_feedback">[];
  divisions: { id: string; name: string }[];
}) {
  const [pending, start] = useTransition();
  const toast = useToast();
  if (!feedback.length) {
    return <div className="empty"><p>No feedback yet. What people send from the “Leave feedback” button lands here.</p></div>;
  }
  return (
    <div className="bp-rows">
      {feedback.map((f) => (
        <div key={f.id} className="bp-item">
          <div className="main">
            <b>{f.staff_name ?? "Someone"}</b>
            <span className="meta">
              {[divisions.find((d) => d.id === f.division_id)?.name, f.page, fmtStamp(f.created_at)].filter(Boolean).join(" · ")}
            </span>
            <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{f.body}</p>
          </div>
          <button
            type="button"
            className="btn sm ghost"
            disabled={pending}
            onClick={() => start(async () => { const r = await deleteFeedback(f.id); toast(r.ok ? (r.message ?? "") : (r.error ?? "")); })}
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}
