"use client";

import Link from "next/link";
import { ConfirmButton, Drawer, useDrawer } from "@/components/drawer";
import type { Tables } from "@/lib/database.types";
import { fmtDate } from "@/lib/dates";
import { label, MAINT_CATEGORIES } from "@/lib/estate";
import { fmtMoney } from "@/lib/shop";
import { STATUSES, statusName } from "@/lib/tasks";
import { saveLotTask } from "../actions";

type Task = Tables<"tasks">;

const when = (t: Task) =>
  t.status === "done"
    ? (t.completed_at ?? t.created_at).slice(0, 10)
    : (t.due_date ?? null);

/** The property's maintenance log: Operations tasks linked to this lot, read live. */
export function LotMaintenance({
  lotId,
  tasks,
  team,
  today,
}: {
  lotId: string;
  tasks: Task[];
  team: { id: string; name: string }[];
  today: string;
}) {
  const drawer = useDrawer<Task>();
  const t = drawer.item;
  const nameOf = (id: string | null) => team.find((m) => m.id === id)?.name ?? null;

  const open = tasks
    .filter((x) => x.status !== "done")
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  const done = tasks
    .filter((x) => x.status === "done")
    .sort((a, b) => (when(b) ?? "").localeCompare(when(a) ?? ""));
  const spent = done.reduce<Record<string, number>>(
    (a, x) => (x.cost ? { ...a, [x.currency]: (a[x.currency] ?? 0) + Number(x.cost) } : a),
    {},
  );

  const table = (list: Task[], empty: string) =>
    list.length === 0 ? (
      <p className="muted" style={{ margin: 0 }}>{empty}</p>
    ) : (
      <div className="table-wrap" style={{ margin: 0 }}>
        <table className="lines-table">
          <thead>
            <tr>
              <th>{list[0].status === "done" ? "Done" : "Due"}</th>
              <th>Task</th>
              <th>Who</th>
              <th>Status</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            {list.map((x) => {
              const d = when(x);
              return (
                <tr key={x.id}>
                  <td>
                    {d ? fmtDate(d, { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    {x.status !== "done" && d && d < today && <span className="tag-sm out" style={{ display: "block", width: "fit-content" }}>overdue</span>}
                  </td>
                  <td>
                    <button type="button" className="linkish" onClick={() => drawer.openItem(x)}>{x.title}</button>
                    <span className="muted" style={{ display: "block", fontSize: 12.5 }}>
                      {label(MAINT_CATEGORIES, x.maint_category ?? "other")}
                      {!x.owner_visible ? " · hidden from the owner" : ""}
                    </span>
                  </td>
                  <td>{nameOf(x.assignee_id) ?? x.done_by ?? <span className="muted">Unassigned</span>}</td>
                  <td>{statusName(x.status)}</td>
                  <td>{x.cost ? fmtMoney(Number(x.cost), x.currency) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section className="panel">
        <h2>
          Open
          <button type="button" className="btn primary sm" onClick={drawer.openNew}>New task</button>
        </h2>
        {table(open, "Nothing open. Tasks linked to this property on the Operations board show up here.")}
        <p className="muted" style={{ fontSize: 13, margin: "10px 0 0" }}>
          This list is read from Operations, so there is nothing to keep in sync. <Link href="/operations">Open the board</Link>
        </p>
      </section>
      <section className="panel">
        <h2>Completed</h2>
        {Object.keys(spent).length > 0 && (
          <p className="muted" style={{ margin: "-4px 0 10px", fontSize: 13.5 }}>
            Spent so far: {Object.entries(spent).map(([c, v]) => fmtMoney(v, c)).join(" and ")}.
          </p>
        )}
        {table(done, "Nothing finished yet.")}
      </section>

      <Drawer
        key={t?.id ?? "new-task"}
        title={t ? "Edit task" : "New task"}
        open={drawer.open}
        onClose={drawer.close}
        action={saveLotTask}
        footer={
          <>
            {t && <ConfirmButton />}
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={drawer.close}>Cancel</button>
            <button type="submit" className="btn primary">Save</button>
          </>
        }
      >
        <input type="hidden" name="lot_id" value={lotId} />
        {t && <input type="hidden" name="id" value={t.id} />}
        <div className="fld">
          <label htmlFor="lt-title">What needs doing</label>
          <input id="lt-title" name="title" required defaultValue={t?.title ?? ""} placeholder="e.g. Pool pump replaced" />
        </div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="lt-cat">Type</label>
            <select id="lt-cat" name="maint_category" defaultValue={t?.maint_category ?? "repair"}>
              {MAINT_CATEGORIES.map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label htmlFor="lt-status">Status</label>
            <select id="lt-status" name="status" defaultValue={t?.status ?? "backlog"}>
              {STATUSES.map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="lt-asg">Assigned to</label>
            <select id="lt-asg" name="assignee_id" defaultValue={t?.assignee_id ?? ""}>
              <option value="">Unassigned</option>
              {team.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label htmlFor="lt-due">Due</label>
            <input id="lt-due" name="due_date" type="date" defaultValue={t?.due_date ?? ""} />
          </div>
        </div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="lt-cost">Cost (₡)</label>
            <input id="lt-cost" name="cost" type="number" min={0} step="any" defaultValue={t?.cost ?? ""} placeholder="Optional" />
          </div>
          <div className="fld">
            <label htmlFor="lt-by">Done by</label>
            <input id="lt-by" name="done_by" defaultValue={t?.done_by ?? ""} placeholder="Contractor or company" />
          </div>
        </div>
        <div className="fld">
          <label htmlFor="lt-desc">Details</label>
          <textarea id="lt-desc" name="description" rows={4} defaultValue={t?.description ?? ""} />
        </div>
        <label className="check">
          <input type="checkbox" name="owner_visible" defaultChecked={t?.owner_visible ?? true} />
          Show to the owner on My Property
        </label>
      </Drawer>
    </div>
  );
}
