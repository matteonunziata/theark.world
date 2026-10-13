"use client";

import { useState, useTransition } from "react";
import { Drawer } from "@/components/drawer";
import { useToast } from "@/components/toast";
import type { Pipeline } from "@/lib/crm";
import { deletePipeline, savePipeline } from "../actions";

type Row = { id: number; key: string | null; label: string };

/** Drawer for creating or editing a pipeline: its name and its ordered stages. */
export function PipelineEditor({
  open,
  pipeline,
  counts,
  onClose,
  onDeleted,
}: {
  open: boolean;
  pipeline: Pipeline | null;
  counts: Record<string, number>;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [name, setName] = useState(pipeline?.name ?? "");
  const [next, setNext] = useState(100);
  const [rows, setRows] = useState<Row[]>(
    pipeline
      ? pipeline.stages.map(([key, label], id) => ({ id, key, label }))
      : [{ id: 0, key: null, label: "" }],
  );
  const [armed, setArmed] = useState(false);

  const edit = (id: number, patch: Partial<Row>) =>
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const swap = (i: number, j: number) =>
    setRows((r) => {
      const c = [...r];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const save = () =>
    start(async () => {
      const r = await savePipeline(
        pipeline?.key ?? null,
        name,
        rows.map(({ key, label }) => ({ key, label })),
      );
      toast(r.ok ? (r.message ?? "Saved") : (r.error ?? ""));
      if (r.ok) onClose();
    });

  const remove = () =>
    start(async () => {
      const r = await deletePipeline(pipeline?.key ?? "");
      toast(r.ok ? (r.message ?? "Deleted") : (r.error ?? ""));
      if (r.ok) {
        onDeleted();
        onClose();
      }
    });

  return (
    <Drawer
      title={pipeline ? "Edit pipeline" : "New pipeline"}
      open={open}
      onClose={onClose}
      footer={
        <>
          {pipeline &&
            (armed ? (
              <button type="button" className="btn danger armed" onClick={remove}>
                Confirm delete
              </button>
            ) : (
              <button type="button" className="btn danger" onClick={() => setArmed(true)}>
                Delete pipeline
              </button>
            ))}
          <button type="button" className="btn primary" disabled={pending} onClick={save}>
            Save
          </button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="pipe-name">Name</label>
        <input id="pipe-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label>Stages, left to right</label>
        {rows.map((r, i) => (
          <div key={r.id} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <input
              aria-label={`Stage ${i + 1}`}
              value={r.label}
              onChange={(e) => edit(r.id, { label: e.target.value })}
              style={{ flex: 1 }}
            />
            <button type="button" className="btn" aria-label="Move left" disabled={i === 0} onClick={() => swap(i, i - 1)}>
              ↑
            </button>
            <button type="button" className="btn" aria-label="Move right" disabled={i === rows.length - 1} onClick={() => swap(i, i + 1)}>
              ↓
            </button>
            <button
              type="button"
              className="btn"
              aria-label="Remove stage"
              disabled={rows.length === 1}
              onClick={() => setRows((x) => x.filter((y) => y.id !== r.id))}
            >
              ×
            </button>
            {r.key && counts[r.key] ? (
              <span className="muted" style={{ alignSelf: "center", fontSize: 12.5 }}>
                {counts[r.key]}
              </span>
            ) : null}
          </div>
        ))}
        <button
          type="button"
          className="btn"
          onClick={() => {
            setRows((x) => [...x, { id: next, key: null, label: "" }]);
            setNext(next + 1);
          }}
        >
          Add stage
        </button>
      </div>
      {pipeline && (
        <p className="note">
          Removing a stage moves the people in it to the first stage. Deleting the
          pipeline takes {total} {total === 1 ? "person" : "people"} out of it; they
          stay in the CRM.
        </p>
      )}
    </Drawer>
  );
}
