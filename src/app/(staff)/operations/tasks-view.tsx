"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import { ConfirmButton, Drawer, useDrawer } from "@/components/drawer";
import { useToast } from "@/components/toast";
import type { Tables } from "@/lib/database.types";
import { MAINT_CATEGORIES } from "@/lib/estate";
import { colorVar } from "@/lib/roles";
import {
  dueClass,
  dueLabel,
  kindLabel,
  PRIORITIES,
  priName,
  STATUSES,
  sortTasks,
  statusName,
  TASK_KINDS,
} from "@/lib/tasks";
import { saveTask, setTaskStatus } from "./actions";

type Task = Tables<"tasks">;
type LotRef = { id: string; code: string; name: string | null };
type Person = { id: string; name: string; status: string };
type Division = { id: string; name: string; color: string };

const LOCATIONS = ["The Shala", "Spa deck", "Cowork lounge", "Courts", "Gym", "The House", "Farm"];

export function TasksView({
  view,
  today,
  initialAssignee = "",
  staffId,
  tasks,
  team,
  divisions,
  lots,
}: {
  view: "board" | "list";
  today: string;
  initialAssignee?: string;
  staffId: string;
  tasks: Task[];
  team: Person[];
  divisions: Division[];
  lots: LotRef[];
}) {
  const [f, setF] = useState({ asg: initialAssignee, div: "", pri: "", kind: "", status: "open" });
  const [showDone, setShowDone] = useState(false);
  const [over, setOver] = useState("");
  const drawer = useDrawer<Task>();
  const toast = useToast();
  const [, start] = useTransition();
  const [list, move] = useOptimistic(tasks, (cur, m: { id: string; status: string }) =>
    cur.map((t) => (t.id === m.id ? { ...t, status: m.status } : t)),
  );

  const lotName = (id: string | null) => {
    const l = lots.find((x) => x.id === id);
    return l ? (l.name ?? `Lot ${l.code}`) : "";
  };
  const person = (id: string | null) => team.find((m) => m.id === id);
  const div = (id: string | null) => divisions.find((d) => d.id === id);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value });

  const filtered = list.filter(
    (t) =>
      (!f.asg ||
        (f.asg === "none" ? !t.assignee_id : f.asg === "me" ? t.assignee_id === staffId : t.assignee_id === f.asg)) &&
      (!f.div || t.division_id === f.div) &&
      (!f.pri || t.priority === f.pri) &&
      (!f.kind || t.kind === f.kind),
  );

  const drop = (id: string, status: string) => {
    const t = list.find((x) => x.id === id);
    if (!t || t.status === status) return;
    start(async () => {
      move({ id, status });
      const r = await setTaskStatus(id, status);
      if (!r.ok) toast(r.error ?? "");
    });
  };

  return (
    <>
      <div className="toolbar">
        <select className="field-in" aria-label="Filter by assignee" value={f.asg} onChange={set("asg")}>
          <option value="">Anyone</option>
          <option value="me">Me</option>
          <option value="none">Unassigned</option>
          {team
            .filter((m) => m.status !== "inactive")
            .map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
        </select>
        <select className="field-in" aria-label="Filter by division" value={f.div} onChange={set("div")}>
          <option value="">All divisions</option>
          {divisions.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <select className="field-in" aria-label="Filter by priority" value={f.pri} onChange={set("pri")}>
          <option value="">Any priority</option>
          {PRIORITIES.map(([k, l]) => (
            <option key={k} value={k}>{l}</option>
          ))}
        </select>
        <select className="field-in" aria-label="Filter by type" value={f.kind} onChange={set("kind")}>
          <option value="">All types</option>
          {TASK_KINDS.map(([k, l]) => (
            <option key={k} value={k}>{l}</option>
          ))}
        </select>
        {view === "list" && (
          <select className="field-in" aria-label="Filter by status" value={f.status} onChange={set("status")}>
            <option value="open">Open</option>
            {STATUSES.map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
            <option value="">Everything</option>
          </select>
        )}
        <button type="button" className="btn primary" style={{ marginLeft: "auto" }} onClick={drawer.openNew}>
          New task
        </button>
      </div>

      {!tasks.length ? (
        <div className="empty">
          <h2>No tasks yet</h2>
          <p>
            Add the first thing that needs doing, assign it to someone, and move
            it across the pipeline as it progresses.
          </p>
          <button type="button" className="btn primary" onClick={drawer.openNew}>
            New task
          </button>
        </div>
      ) : view === "board" ? (
        <div className="board">
          {STATUSES.map(([k, l]) => {
            let col = sortTasks(filtered.filter((t) => t.status === k));
            const total = col.length;
            const collapsed = k === "done" && !showDone && total > 5;
            if (collapsed) col = col.slice(0, 5);
            return (
              <section
                key={k}
                className={`col ${over === k ? "over" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(k);
                }}
                onDragLeave={() => setOver("")}
                onDrop={(e) => {
                  e.preventDefault();
                  setOver("");
                  drop(e.dataTransfer.getData("text/plain"), k);
                }}
              >
                <header>
                  {l}
                  <span>{total}</span>
                </header>
                {col.map((t) => {
                  const a = person(t.assignee_id);
                  const d = div(t.division_id);
                  return (
                    <button
                      type="button"
                      key={t.id}
                      className="task"
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                      onClick={() => drawer.openItem(t)}
                    >
                      {(t.kind !== "task" || d) && (
                        <span className="tkind">
                          {[t.kind !== "task" ? kindLabel(t.kind) : "", d?.name ?? "", lotName(t.lot_id)].filter(Boolean).join(", ")}
                        </span>
                      )}
                      <b>{t.title}</b>
                      <span className="tmeta">
                        <span className={`pri ${t.priority}`}>
                          <i />
                          {priName(t.priority)}
                        </span>
                        {t.due_date && (
                          <span className={`due ${dueClass(t.due_date, t.status, today)}`}>
                            {dueLabel(t.due_date, today)}
                          </span>
                        )}
                        {a && <Avatar name={a.name} color={d ? colorVar(d.color) : "var(--slate)"} />}
                      </span>
                    </button>
                  );
                })}
                {collapsed && (
                  <button type="button" className="more" onClick={() => setShowDone(true)}>
                    Show all {total}
                  </button>
                )}
                {!total && (
                  <p className="muted" style={{ fontSize: 12.5, margin: 0, padding: "4px 6px" }}>
                    Nothing here
                  </p>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        (() => {
          const rows = sortTasks(
            filtered.filter((t) =>
              f.status === "" ? true : f.status === "open" ? t.status !== "done" : t.status === f.status,
            ),
          );
          return !rows.length ? (
            <div className="empty">
              <p>No tasks match those filters.</p>
            </div>
          ) : (
            <div className="list">
              <div className="row head trow2">
                <span>Task</span>
                <span className="c-asg">Assigned to</span>
                <span className="c-div">Division</span>
                <span className="c-due">Due</span>
                <span>Status</span>
              </div>
              {rows.map((t) => {
                const a = person(t.assignee_id);
                const d = div(t.division_id);
                return (
                  <button type="button" className="row trow2" key={t.id} onClick={() => drawer.openItem(t)}>
                    <span className="who" style={{ display: "block" }}>
                      <b>{t.title}</b>
                      <span className={`pri ${t.priority}`}>
                        <i />
                        {priName(t.priority)}
                        {t.kind !== "task" ? `, ${kindLabel(t.kind)}` : ""}
                      </span>
                    </span>
                    <span className={`c-asg ${a ? "" : "muted"}`}>{a ? a.name : "Unassigned"}</span>
                    <span className="c-div">
                      {d ? (
                        <span className="chip">
                          <i style={{ background: colorVar(d.color) }} />
                          {d.name}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </span>
                    <span className={`c-due due ${dueClass(t.due_date, t.status, today)}`}>
                      {dueLabel(t.due_date, today) || <span className="muted">—</span>}
                    </span>
                    <span className={`status ${t.status === "done" ? "off" : "on"}`}>{statusName(t.status)}</span>
                  </button>
                );
              })}
            </div>
          );
        })()
      )}

      <TaskDrawer
        key={drawer.item?.id ?? "new"}
        open={drawer.open}
        t={drawer.item}
        team={team}
        divisions={divisions}
        lots={lots}
        onClose={drawer.close}
      />
    </>
  );
}

function TaskDrawer({
  open,
  t,
  team,
  divisions,
  lots,
  onClose,
}: {
  open: boolean;
  t: Task | null;
  team: Person[];
  divisions: Division[];
  lots: LotRef[];
  onClose: () => void;
}) {
  const [status, setStatus] = useState(t?.status ?? "backlog");
  const [kind, setKind] = useState(t?.kind ?? "task");
  const [lotId, setLotId] = useState(t?.lot_id ?? "");
  return (
    <Drawer
      title={t ? "Edit task" : "New task"}
      open={open}
      onClose={onClose}
      action={saveTask}
      footer={
        <>
          {t && <ConfirmButton />}
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary">
            {t ? "Save changes" : "Add task"}
          </button>
        </>
      }
    >
      {t && <input type="hidden" name="id" value={t.id} />}
      <input type="hidden" name="status" value={status} />
      <div className="fld">
        <label htmlFor="t-title">What needs doing</label>
        <input id="t-title" name="title" defaultValue={t?.title} required placeholder="e.g. Fix the sauna door hinge" />
      </div>
      <div className="fld">
        <label htmlFor="t-desc">Details</label>
        <textarea id="t-desc" name="description" defaultValue={t?.description ?? ""} placeholder="Anything the person doing it needs to know" />
      </div>
      <div className="grid2">
        <div className="fld">
          <label htmlFor="t-asg">Assigned to</label>
          <select id="t-asg" name="assignee_id" defaultValue={t?.assignee_id ?? ""}>
            <option value="">Unassigned</option>
            {team
              .filter((m) => m.status !== "inactive")
              .map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
          </select>
        </div>
        <div className="fld">
          <label htmlFor="t-div">Division</label>
          <select id="t-div" name="division_id" defaultValue={t?.division_id ?? ""}>
            <option value="">None</option>
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid2">
        <div className="fld">
          <label htmlFor="t-pri">Priority</label>
          <select id="t-pri" name="priority" defaultValue={t?.priority ?? "medium"}>
            {PRIORITIES.map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
        </div>
        <div className="fld">
          <label htmlFor="t-kind">Type</label>
          <select id="t-kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            {TASK_KINDS.map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid2">
        <div className="fld">
          <label htmlFor="t-due">Due</label>
          <input id="t-due" name="due_date" type="date" defaultValue={t?.due_date ?? ""} />
        </div>
        <div className="fld">
          <label htmlFor="t-loc">Location</label>
          <input id="t-loc" name="location" list="task-locs" defaultValue={t?.location ?? ""} placeholder="Where on-site" />
          <datalist id="task-locs">
            {LOCATIONS.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
        </div>
      </div>
      <div className="fld">
        <label htmlFor="t-lot">Property</label>
        <select id="t-lot" name="lot_id" value={lotId} onChange={(e) => setLotId(e.target.value)}>
          <option value="">Not tied to a property</option>
          {lots.map((l) => (
            <option key={l.id} value={l.id}>{l.name ? `${l.name} (Lot ${l.code})` : `Lot ${l.code}`}</option>
          ))}
        </select>
      </div>
      {lotId && (
        <>
          <div className="grid2">
            <div className="fld">
              <label htmlFor="t-mcat">Work type</label>
              <select id="t-mcat" name="maint_category" defaultValue={t?.maint_category ?? "repair"}>
                {MAINT_CATEGORIES.map(([k, l]) => (
                  <option key={k} value={k}>{l}</option>
                ))}
              </select>
            </div>
            <div className="fld">
              <label htmlFor="t-cost">Cost (₡)</label>
              <input id="t-cost" name="cost" type="number" min={0} step="any" defaultValue={t?.cost ?? ""} placeholder="Optional" />
            </div>
          </div>
          <div className="grid2">
            <div className="fld">
              <label htmlFor="t-doneby">Done by</label>
              <input id="t-doneby" name="done_by" defaultValue={t?.done_by ?? ""} placeholder="Contractor or company" />
            </div>
            <label className="check" style={{ alignSelf: "end", paddingBottom: 8 }}>
              <input type="checkbox" name="owner_visible" defaultChecked={t?.owner_visible ?? true} />
              Show to the owner
            </label>
          </div>
        </>
      )}
      <div className="fld">
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>Stage</span>
        <div className="movebar">
          {STATUSES.map(([k, l]) => (
            <button
              type="button"
              key={k}
              className={`btn ${status === k ? "cur" : ""}`}
              aria-pressed={status === k}
              onClick={() => setStatus(k)}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
    </Drawer>
  );
}
