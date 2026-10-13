"use client";

import { ConfirmButton, Drawer, useDrawer } from "@/components/drawer";
import type { Tables } from "@/lib/database.types";
import { addDays, fmtDate } from "@/lib/dates";
import { saveCurriculumWeek } from "./actions";

type Week = Tables<"school_curriculum">;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

const plans = (w: Week) =>
  (Array.isArray(w.daily) ? (w.daily as { day?: string; plan?: string }[]) : []).filter((d) => d.day && d.plan);

export function CurriculumTab({
  weeks,
  groups,
  thisWeek,
}: {
  weeks: Week[];
  groups: string[];
  thisWeek: string;
}) {
  const drawer = useDrawer<Week>();
  const lastWeek = weeks.at(-1);
  const nextNo = (lastWeek?.week_no ?? 0) + 1;
  const nextStart = lastWeek && lastWeek.starts_on >= thisWeek ? addDays(lastWeek.starts_on, 7) : thisWeek;

  return (
    <>
      <div className="toolbar">
        <span className="muted" style={{ fontSize: 13.5 }}>
          One theme a week. Open a week to see the day by day plan.
        </span>
        <button type="button" className="btn primary" style={{ marginLeft: "auto" }} onClick={drawer.openNew}>
          Add a week
        </button>
      </div>
      {!weeks.length ? (
        <div className="empty">
          <h2>No curriculum yet</h2>
          <p>
            Add each week’s theme, a short summary and what happens each day.
            The current week shows at the top of this page.
          </p>
          <button type="button" className="btn primary" onClick={drawer.openNew}>Add the first week</button>
        </div>
      ) : (
        <div className="cur-grid">
          {weeks.map((w) => {
            const isNow = w.starts_on === thisWeek;
            const past = w.starts_on < thisWeek;
            const daily = plans(w);
            return (
              <button
                key={w.id}
                type="button"
                className={`cur-card ${isNow ? "now" : ""} ${w.starts_on > thisWeek ? "later" : ""}`}
                onClick={() => drawer.openItem(w)}
              >
                <header>
                  <b>Week {w.week_no}</b>
                  {isNow ? <span className="tag-sm">Now</span> : past ? <span aria-label="Done">✓</span> : null}
                </header>
                <span className="cur-title">{w.title}</span>
                <span className="muted">
                  {fmtDate(w.starts_on, { month: "short", day: "numeric" })}
                  {w.group_name ? ` · ${w.group_name}` : ""}
                </span>
                {w.summary && <span className="cur-sum">{w.summary}</span>}
                {daily.length > 0 && (
                  <ul>
                    {daily.map((d) => (
                      <li key={d.day}><b>{d.day}</b> {d.plan}</li>
                    ))}
                  </ul>
                )}
              </button>
            );
          })}
        </div>
      )}

      <Drawer
        key={drawer.item?.id ?? "new"}
        title={drawer.item ? `Week ${drawer.item.week_no}` : "Add a week"}
        open={drawer.open}
        onClose={drawer.close}
        action={saveCurriculumWeek}
        footer={
          <>
            {drawer.item && <ConfirmButton label="Remove" />}
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={drawer.close}>Cancel</button>
            <button type="submit" className="btn primary">Save</button>
          </>
        }
      >
        {drawer.item && <input type="hidden" name="id" value={drawer.item.id} />}
        <div className="grid2">
          <div className="fld">
            <label htmlFor="cw-no">Week number</label>
            <input id="cw-no" name="week_no" type="number" min={1} max={60} required defaultValue={drawer.item?.week_no ?? nextNo} />
          </div>
          <div className="fld">
            <label htmlFor="cw-start">Starts on (Monday)</label>
            <input id="cw-start" name="starts_on" type="date" required defaultValue={drawer.item?.starts_on ?? nextStart} />
          </div>
        </div>
        <div className="fld">
          <label htmlFor="cw-title">Theme</label>
          <input id="cw-title" name="title" required defaultValue={drawer.item?.title ?? ""} placeholder="e.g. Birds & feathers" />
        </div>
        <div className="fld">
          <label htmlFor="cw-group">Group</label>
          <input id="cw-group" name="group_name" list="cw-groups" defaultValue={drawer.item?.group_name ?? ""} placeholder="Leave empty for the whole school" />
          <datalist id="cw-groups">
            {groups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </div>
        <div className="fld">
          <label htmlFor="cw-sum">Summary</label>
          <textarea id="cw-sum" name="summary" rows={3} defaultValue={drawer.item?.summary ?? ""} placeholder="A line or two on the shape of the week" />
        </div>
        <div className="subhead">Day by day</div>
        {DAYS.map((d) => (
          <div className="fld" key={d}>
            <label htmlFor={`cw-${d}`}>{d}</label>
            <input
              id={`cw-${d}`}
              name={`day_${d}`}
              defaultValue={(drawer.item ? plans(drawer.item) : []).find((p) => p.day === d)?.plan ?? ""}
              placeholder="Optional"
            />
          </div>
        ))}
      </Drawer>
    </>
  );
}
