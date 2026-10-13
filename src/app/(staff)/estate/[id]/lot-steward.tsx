"use client";

import { useActionState, useEffect, useTransition } from "react";
import { useToast } from "@/components/toast";
import type { ActionResult } from "@/lib/action-result";
import type { Tables } from "@/lib/database.types";
import { fmtDate } from "@/lib/dates";
import { fmtMoney } from "@/lib/shop";
import { addTeamNote, deleteTeamNote, requestPropertyBudget, withdrawPropertyBudget } from "../actions";

type Note = Tables<"property_notes">;
type Budget = Tables<"property_budgets">;

const day = (d: string) => fmtDate(d.slice(0, 10), { month: "short", day: "numeric", year: "numeric" });

function useForm(action: (p: ActionResult, d: FormData) => Promise<ActionResult>) {
  const toast = useToast();
  const [state, run, pending] = useActionState(action, { ok: false } as ActionResult);
  useEffect(() => {
    if (state.ok && state.message) toast(state.message);
    if (!state.ok && state.error) toast(state.error);
  }, [state, toast]);
  return { run, pending, key: state.ok ? state.message : "f" };
}

/** What the steward sees and decides on this property: shared notes and budgets waiting on their approval. */
export function LotSteward({
  lotId,
  notes,
  budgets,
  tasks,
  hasSteward,
}: {
  lotId: string;
  notes: Note[];
  budgets: Budget[];
  tasks: Tables<"tasks">[];
  hasSteward: boolean;
}) {
  const toast = useToast();
  const [busy, start] = useTransition();
  const note = useForm(addTeamNote);
  const budget = useForm(requestPropertyBudget);
  const act = (p: Promise<ActionResult>) =>
    start(async () => {
      const r = await p;
      toast(r.ok ? (r.message ?? "Saved") : (r.error ?? "Couldn’t save"));
    });
  return (
    <div className="lot-grid" style={{ display: "grid", gap: 16 }}>
      {!hasSteward && (
        <p className="muted" style={{ margin: 0 }}>
          No steward is linked to this property yet, so nobody will see these until one is added on the Overview tab.
        </p>
      )}
      <section className="panel">
        <h2>Budgets for the steward to approve</h2>
        {budgets.length === 0 && <p className="muted" style={{ marginTop: 0 }}>No budgets asked for yet.</p>}
        {budgets.map((b) => (
          <div key={b.id} style={{ padding: "10px 0", borderTop: "1px solid var(--line, #0001)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <b>{b.title}</b>
              <span>{fmtMoney(Number(b.amount), "CRC")}</span>
            </div>
            <div className="muted" style={{ fontSize: 13.5 }}>
              {b.status === "pending" ? "Waiting for the steward" : b.status === "approved" ? "Approved" : "Declined"}
              {b.decided_at ? ` ${day(b.decided_at)}` : ` · asked ${day(b.requested_at)}`}
              {b.decision_comment ? ` · “${b.decision_comment}”` : ""}
            </div>
            {b.status === "pending" && (
              <button type="button" className="btn ghost sm" disabled={busy} onClick={() => act(withdrawPropertyBudget(lotId, b.id))}>
                Withdraw
              </button>
            )}
          </div>
        ))}
        <form action={budget.run} key={budget.key} style={{ display: "grid", gap: 8, marginTop: 14 }}>
          <input type="hidden" name="lot_id" value={lotId} />
          <input name="title" required placeholder="What is it for? e.g. Replace pool pump" aria-label="What is it for" />
          <input name="amount" required inputMode="decimal" placeholder="Amount in colones" aria-label="Amount in colones" />
          <select name="task_id" defaultValue="" aria-label="Linked task">
            <option value="">No linked task</option>
            {tasks
              .filter((t) => t.status !== "done")
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
          </select>
          <textarea name="details" rows={2} placeholder="Details for the steward (optional)" aria-label="Details" />
          <div>
            <button type="submit" className="btn sm" disabled={budget.pending}>
              Ask the steward to approve
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2>Shared notes</h2>
        <form action={note.run} key={note.key} style={{ display: "grid", gap: 8, marginBottom: 10 }}>
          <input type="hidden" name="lot_id" value={lotId} />
          <textarea name="body" rows={3} required placeholder="Write to the steward" aria-label="Note" />
          <div>
            <button type="submit" className="btn sm" disabled={note.pending}>
              Post note
            </button>
          </div>
        </form>
        {notes.length === 0 && <p className="muted" style={{ margin: 0 }}>No notes yet.</p>}
        {notes.map((n) => (
          <div key={n.id} style={{ padding: "10px 0", borderTop: "1px solid var(--line, #0001)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <b>
                {n.author_name}
                <span className="muted" style={{ fontWeight: 400 }}> · {n.author_kind === "team" ? "Team" : "Steward"}</span>
              </b>
              <span className="muted" style={{ fontSize: 13.5 }}>{day(n.created_at)}</span>
            </div>
            <div style={{ whiteSpace: "pre-line", fontSize: 14.5 }}>{n.body}</div>
            {n.author_kind === "team" && (
              <button type="button" className="btn ghost sm" disabled={busy} onClick={() => act(deleteTeamNote(lotId, n.id))}>
                Remove
              </button>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
