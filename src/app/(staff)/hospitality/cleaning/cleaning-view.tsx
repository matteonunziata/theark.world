"use client";

import { useState } from "react";
import { ConfirmButton, Drawer } from "@/components/drawer";
import type { Tables } from "@/lib/database.types";
import { CLEAN_DAYS, cleanDayOf, TIME_SLOTS } from "@/lib/hospitality";
import { saveCleaningTask } from "../actions";

type Task = Tables<"cleaning_tasks">;

export function CleaningView({ tasks, today }: { tasks: Task[]; today: string }) {
  const [editing, setEditing] = useState<Task | null>(null);
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);
  const [byPerson, setByPerson] = useState(true);
  const todayIdx = cleanDayOf(today);

  const edit = (t: Task | null) => {
    setEditing(t);
    setKey((k) => k + 1);
    setOpen(true);
  };

  const areas = new Map<string, Task[]>();
  const groupOf = (t: Task) => (byPerson ? (t.assignee ?? "Unassigned") : t.area);
  for (const t of tasks) areas.set(groupOf(t), [...(areas.get(groupOf(t)) ?? []), t]);
  const todays = tasks
    .filter((t) => t.days.includes(todayIdx))
    .sort((a, b) => a.position - b.position)
    .sort((a, b) => (a.assignee ?? "").localeCompare(b.assignee ?? ""));

  return (
    <>
      <div className="listings-h">
        <p className="muted" style={{ margin: 0 }}>
          {tasks.length
            ? `${todays.length} task${todays.length === 1 ? "" : "s"} today (${CLEAN_DAYS[todayIdx]}). Select a task to change it.`
            : "The cleaning schedule, by area and day."}
        </p>
        <span className="spacer" />
        <button type="button" className="btn sm" onClick={() => setByPerson((v) => !v)}>
          {byPerson ? "Group by area" : "Group by person"}
        </button>
        <button type="button" className="btn primary sm" onClick={() => edit(null)}>Add task</button>
      </div>

      {tasks.length === 0 ? (
        <p className="muted" style={{ marginBottom: 22 }}>
          Nothing scheduled yet. Add the first task and choose the days it happens.
        </p>
      ) : (
        <>
          {todays.length > 0 && (
            <section>
              <h2 className="section-title">Today</h2>
              <div className="table-wrap">
                <table className="lines-table">
                  <tbody>
                    {todays.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <button type="button" className="linkish" onClick={() => edit(t)}>{t.task} <span className="muted">· {t.area}</span></button>
                        </td>
                        <td className="muted">{t.time_slot ?? ""}</td>
                        <td className="muted">{t.assignee ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          <section>
            <h2 className="section-title">The week</h2>
            <div className="table-wrap">
              <table className="lines-table clean-grid">
                <thead>
                  <tr>
                    <th>Task</th>
                    {CLEAN_DAYS.map((d, i) => (
                      <th key={d} className={i === todayIdx ? "today" : ""}>{d}</th>
                    ))}
                    <th>When</th>
                    <th>{byPerson ? "Area" : "Who"}</th>
                  </tr>
                </thead>
                {[...areas].map(([area, rows]) => (
                  <tbody key={area}>
                    <tr className="clean-area"><td colSpan={CLEAN_DAYS.length + 3}>{area}</td></tr>
                    {rows.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <button type="button" className="linkish" onClick={() => edit(t)}>{t.task}</button>
                        </td>
                        {CLEAN_DAYS.map((d, i) => (
                          <td key={d} className={i === todayIdx ? "today" : ""}>
                            {t.days.includes(i) ? <span aria-label={`${d}: yes`}>●</span> : <span className="muted" aria-hidden>·</span>}
                          </td>
                        ))}
                        <td className="muted">{t.time_slot ?? ""}</td>
                        <td className="muted">{(byPerson ? t.area : t.assignee) ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            </div>
          </section>
        </>
      )}

      <Drawer
        key={key}
        title={editing ? "Edit task" : "Add a cleaning task"}
        open={open}
        onClose={() => setOpen(false)}
        action={saveCleaningTask}
        footer={
          <>
            {editing && <ConfirmButton />}
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="btn primary">Save</button>
          </>
        }
      >
        {editing && <input type="hidden" name="id" value={editing.id} />}
        <div className="grid2">
          <div className="fld">
            <label htmlFor="cl-area">Area</label>
            <input id="cl-area" name="area" list="cl-areas" required defaultValue={editing?.area ?? ""} placeholder="Kitchen" />
            <datalist id="cl-areas">
              {[...new Set(tasks.map((t) => t.area))].map((a) => <option key={a} value={a} />)}
            </datalist>
          </div>
          <div className="fld">
            <label htmlFor="cl-slot">When</label>
            <input id="cl-slot" name="time_slot" list="cl-slots" defaultValue={editing?.time_slot ?? ""} placeholder="Morning" />
            <datalist id="cl-slots">
              {TIME_SLOTS.map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>
        </div>
        <div className="fld">
          <label htmlFor="cl-task">Task</label>
          <input id="cl-task" name="task" required defaultValue={editing?.task ?? ""} placeholder="Mop floors" />
        </div>
        <div className="fld">
          <span className="lbl">Days</span>
          <div className="pill-row" style={{ marginBottom: 0 }}>
            {CLEAN_DAYS.map((d, i) => (
              <label key={d} className="check">
                <input type="checkbox" name="days" value={i} defaultChecked={editing?.days.includes(i) ?? false} />
                {d}
              </label>
            ))}
          </div>
        </div>
        <div className="fld">
          <label htmlFor="cl-who">Who</label>
          <input id="cl-who" name="assignee" defaultValue={editing?.assignee ?? ""} placeholder="Name or team" />
        </div>
        <div className="fld">
          <label htmlFor="cl-notes">Notes</label>
          <textarea id="cl-notes" name="notes" rows={3} defaultValue={editing?.notes ?? ""} />
        </div>
      </Drawer>
    </>
  );
}
