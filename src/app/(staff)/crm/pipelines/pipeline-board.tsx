"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import type { CSSProperties } from "react";
import { type Pipeline, tierName } from "@/lib/crm";
import { setStage } from "../actions";
import { PipelineEditor } from "./pipeline-editor";

type Person = {
  id: string;
  name: string;
  tier: string | null;
  location: string | null;
  source: string | null;
  lot: string | null;
  visit_date: string | null;
  tafo_choice: string | null;
};
type StageRow = { contact_id: string; pipeline: string; stage: string };

export function PipelineBoard({
  contacts,
  stages,
  pipelines,
  isAdmin,
  canEdit,
}: {
  contacts: Person[];
  stages: StageRow[];
  pipelines: Pipeline[];
  isAdmin: boolean;
  canEdit: boolean;
}) {
  const [picked, setPipe] = useState("memberships");
  const [editing, setEditing] = useState<Pipeline | null | undefined>(undefined);
  const [over, setOver] = useState("");
  const router = useRouter();
  const toast = useToast();
  const [, start] = useTransition();
  const [rows, move] = useOptimistic(
    stages,
    (cur, m: { contact_id: string; stage: string }) =>
      cur.map((s) =>
        s.contact_id === m.contact_id && s.pipeline === pipe ? { ...s, stage: m.stage } : s,
      ),
  );

  const p = pipelines.find((x) => x.key === picked) ?? pipelines[0];
  const pipe = p?.key ?? "";
  const inPipe = rows.filter((s) => s.pipeline === pipe);
  const person = (id: string) => contacts.find((c) => c.id === id);

  const drop = (contactId: string, stage: string) => {
    const cur = inPipe.find((s) => s.contact_id === contactId);
    if (!cur || cur.stage === stage) return;
    start(async () => {
      move({ contact_id: contactId, stage });
      const r = await setStage(contactId, pipe, stage);
      if (!r.ok) toast(r.error ?? "");
    });
  };

  return (
    <>
      <div className="pipe-pick" role="group" aria-label="Pipeline">
        {pipelines.map((x) => (
          <button
            key={x.key}
            type="button"
            className="pill"
            aria-pressed={pipe === x.key}
            onClick={() => setPipe(x.key)}
          >
            {x.name}
          </button>
        ))}
        {isAdmin && (
          <>
            {p && (
              <button type="button" className="btn" onClick={() => setEditing(p)}>
                Edit pipeline
              </button>
            )}
            <button type="button" className="btn" onClick={() => setEditing(null)}>
              New pipeline
            </button>
          </>
        )}
      </div>
      {!p && <p className="note">No pipelines yet.</p>}
      <div className="pipe">
        <div className="board" style={{ "--cols": p?.stages.length ?? 6 } as CSSProperties}>
          {p?.stages.map(([sk, sl]) => {
            const list = inPipe
              .filter((s) => s.stage === sk)
              .map((s) => person(s.contact_id))
              .filter((x): x is Person => !!x)
              .sort((a, b) => a.name.localeCompare(b.name));
            return (
              <section
                key={sk}
                className={`col ${over === sk ? "over" : ""}`}
                onDragOver={(e) => {
                  if (!canEdit) return;
                  e.preventDefault();
                  setOver(sk);
                }}
                onDragLeave={() => setOver("")}
                onDrop={(e) => {
                  e.preventDefault();
                  setOver("");
                  drop(e.dataTransfer.getData("text/plain"), sk);
                }}
              >
                <header>
                  {sl}
                  <span>{list.length}</span>
                </header>
                {list.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="task"
                    draggable={canEdit}
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", c.id)}
                    onClick={() => router.push(`/crm/contact/${c.id}`)}
                  >
                    <b>{c.name}</b>
                    <span className="who-sm">
                      {pipe === "memberships"
                        ? c.tier
                          ? tierName(c.tier)
                          : c.location || c.source || ""
                        : pipe.startsWith("stewardship")
                          ? [
                              c.lot ? `Lot ${c.lot}` : "",
                              c.visit_date ? `Visit ${c.visit_date}` : "",
                              c.tafo_choice ? `TAFO ${c.tafo_choice}` : "",
                            ]
                              .filter(Boolean)
                              .join(" · ") || c.location || ""
                          : c.lot
                            ? `Lot ${c.lot}`
                            : c.location || ""}
                    </span>
                  </button>
                ))}
                {!list.length && (
                  <p className="muted" style={{ fontSize: 12.5, margin: 0, padding: "4px 6px" }}>
                    Nothing here
                  </p>
                )}
              </section>
            );
          })}
        </div>
      </div>
      <p className="note">
        {inPipe.length
          ? `${inPipe.length} in this pipeline. Drag between stages, or open someone’s profile to change it.`
          : "Nobody in this pipeline yet. Open a person’s profile and set their stage under Pipelines."}
      </p>
      <PipelineEditor
        key={editing === undefined ? "closed" : (editing?.key ?? "new")}
        open={editing !== undefined}
        pipeline={editing ?? null}
        counts={inPipe.reduce<Record<string, number>>((m, s) => {
          m[s.stage] = (m[s.stage] ?? 0) + 1;
          return m;
        }, {})}
        onClose={() => setEditing(undefined)}
        onDeleted={() => setPipe("")}
      />
    </>
  );
}
