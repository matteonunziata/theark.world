"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmButton, Drawer, useDrawer } from "@/components/drawer";
import type { Tables } from "@/lib/database.types";
import { addDays, DOW, fmtDate, fmtTime } from "@/lib/dates";
import { scheduleFor } from "@/lib/school";
import { saveScheduleEntry } from "../actions";

type Entry = Tables<"school_schedule">;
const WEEK = [1, 2, 3, 4, 5, 6, 0];

export function TimetableView({
  entries,
  groups,
  team,
  from,
  today,
  group,
}: {
  entries: Entry[];
  groups: string[];
  team: { id: string; name: string }[];
  from: string;
  today: string;
  group: string;
}) {
  const router = useRouter();
  const drawer = useDrawer<Entry>();
  const [preset, setPreset] = useState<{ date?: string; weekday?: number }>({});
  const shown = entries.filter((e) => !group || (group === "_all" ? !e.group_name : e.group_name === group || !e.group_name));
  const days = WEEK.map((d, i) => ({ d, date: addDays(from, i) }));
  const weekend = shown.some((e) => (e.weekday !== null ? e.weekday === 0 || e.weekday === 6 : [0, 6].includes(new Date(`${e.on_date}T00:00:00Z`).getUTCDay())));
  const cols = weekend ? days : days.slice(0, 5);
  const teacher = (id: string | null) => team.find((t) => t.id === id)?.name;
  const q = (next: { week?: string; group?: string }) => {
    const s = new URLSearchParams();
    s.set("week", next.week ?? from);
    const g = next.group ?? group;
    if (g) s.set("group", g);
    return `/arkadia/schedule?${s}`;
  };

  return (
    <>
      <p style={{ margin: "0 0 14px" }}>
        <Link href="/arkadia" className="muted">← Arkadia</Link>
      </p>
      <div className="page-head">
        <div>
          <h1>Timetable</h1>
          <p className="lede">
            The weekly rhythm for each group, plus one-off days like trips and
            days off. Families see their child’s day and week on their page.
          </p>
        </div>
      </div>
      <div className="toolbar">
        <select className="field-in" aria-label="Group" value={group} onChange={(e) => router.push(q({ group: e.target.value }))}>
          <option value="">All groups</option>
          <option value="_all">Whole school only</option>
          {groups.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        <div className="weeknav" style={{ margin: 0 }}>
          <Link className="btn sm" href={q({ week: addDays(from, -7) })} aria-label="Previous week">←</Link>
          <Link className="btn sm" href={q({ week: today })}>This week</Link>
          <Link className="btn sm" href={q({ week: addDays(from, 7) })} aria-label="Next week">→</Link>
        </div>
        <span className="muted" style={{ fontSize: 13.5 }}>
          Week of {fmtDate(from, { month: "long", day: "numeric" })}
        </span>
        <button
          type="button"
          className="btn primary"
          style={{ marginLeft: "auto" }}
          onClick={() => {
            setPreset({});
            drawer.openNew();
          }}
        >
          Add to timetable
        </button>
      </div>

      {!entries.length ? (
        <div className="empty">
          <h2>No timetable yet</h2>
          <p>
            Add the regular week: morning circle, lessons, lunch, garden time,
            pickup. Set it for one group or the whole school, and add one-off
            days when plans change.
          </p>
        </div>
      ) : (
        <div className="tt" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>
          {cols.map(({ d, date }) => {
            const items = scheduleFor(shown, date);
            return (
              <section key={date} className={`tt-day ${date === today ? "today" : ""}`}>
                <header>
                  <b>{fmtDate(date, { weekday: "long" })}</b>
                  <span>{fmtDate(date, { month: "short", day: "numeric" })}</span>
                </header>
                {items.map((e) => (
                  <button key={e.id} type="button" className={`tt-item ${e.on_date ? "once" : ""}`} onClick={() => drawer.openItem(e)}>
                    <span className="t">{fmtTime(e.start_time)}–{fmtTime(e.end_time)}</span>
                    <b>{e.title}</b>
                    <span className="m">
                      {[e.group_name ?? "Whole school", e.location, teacher(e.teacher_id)].filter(Boolean).join(" · ")}
                    </span>
                    {e.on_date && <span className="tag-sm">This day only</span>}
                  </button>
                ))}
                <button
                  type="button"
                  className="tt-add"
                  onClick={() => {
                    setPreset({ date, weekday: d });
                    drawer.openNew();
                  }}
                >
                  + Add
                </button>
              </section>
            );
          })}
        </div>
      )}

      <EntryDrawer
        key={drawer.item?.id ?? `new-${preset.date ?? ""}`}
        open={drawer.open}
        onClose={drawer.close}
        entry={drawer.item}
        groups={groups}
        team={team}
        preset={preset}
        defaultGroup={group && group !== "_all" ? group : ""}
      />
    </>
  );
}

function EntryDrawer({
  open,
  onClose,
  entry,
  groups,
  team,
  preset,
  defaultGroup,
}: {
  open: boolean;
  onClose: () => void;
  entry: Entry | null;
  groups: string[];
  team: { id: string; name: string }[];
  preset: { date?: string; weekday?: number };
  defaultGroup: string;
}) {
  const [repeat, setRepeat] = useState(entry ? (entry.on_date ? "once" : "weekly") : "weekly");
  const picked = entry?.weekday ?? preset.weekday;
  return (
    <Drawer
      title={entry ? "Edit timetable entry" : "Add to timetable"}
      open={open}
      onClose={onClose}
      action={saveScheduleEntry}
      footer={
        <>
          {entry && <ConfirmButton label="Remove" />}
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary">Save</button>
        </>
      }
    >
      {entry && <input type="hidden" name="id" value={entry.id} />}
      <div className="fld">
        <label htmlFor="tt-title">What</label>
        <input id="tt-title" name="title" required defaultValue={entry?.title ?? ""} placeholder="e.g. Morning circle, Garden, Lunch" />
      </div>
      <div className="grid2">
        <div className="fld">
          <label htmlFor="tt-start">Starts</label>
          <input id="tt-start" name="start_time" type="time" required defaultValue={entry?.start_time?.slice(0, 5) ?? "08:30"} />
        </div>
        <div className="fld">
          <label htmlFor="tt-end">Ends</label>
          <input id="tt-end" name="end_time" type="time" required defaultValue={entry?.end_time?.slice(0, 5) ?? "09:00"} />
        </div>
      </div>
      <div className="fld">
        <span className="lbl">Repeats</span>
        <div className="seg" role="radiogroup" aria-label="Repeats">
          {[
            ["weekly", "Every week"],
            ["once", "One day only"],
          ].map(([k, l]) => (
            <button key={k} type="button" role="radio" aria-checked={repeat === k} className={repeat === k ? "on" : ""} onClick={() => setRepeat(k)}>
              {l}
            </button>
          ))}
        </div>
        <input type="hidden" name="repeat" value={repeat} />
        {repeat === "weekly" ? (
          <div className="tt-days">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <label key={d} className="check">
                <input
                  type={entry ? "radio" : "checkbox"}
                  name="weekday"
                  value={d}
                  defaultChecked={picked === undefined ? d >= 1 && d <= 5 && !entry : picked === d}
                />
                {DOW[d]}
              </label>
            ))}
          </div>
        ) : (
          <input name="on_date" type="date" required defaultValue={entry?.on_date ?? preset.date ?? ""} aria-label="Date" />
        )}
      </div>
      <div className="grid2">
        <div className="fld">
          <label htmlFor="tt-group">Group</label>
          <input id="tt-group" name="group_name" list="tt-groups" defaultValue={entry?.group_name ?? defaultGroup} placeholder="Leave empty for the whole school" />
          <datalist id="tt-groups">
            {groups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </div>
        <div className="fld">
          <label htmlFor="tt-where">Where</label>
          <input id="tt-where" name="location" defaultValue={entry?.location ?? ""} placeholder="e.g. Garden, Shala" />
        </div>
      </div>
      <div className="fld">
        <label htmlFor="tt-teacher">Teacher</label>
        <select id="tt-teacher" name="teacher_id" defaultValue={entry?.teacher_id ?? ""}>
          <option value="">—</option>
          {team.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>
      <div className="fld">
        <label htmlFor="tt-notes">Note for families</label>
        <textarea id="tt-notes" name="notes" rows={2} defaultValue={entry?.notes ?? ""} placeholder="e.g. Bring a hat and water bottle" />
      </div>
    </Drawer>
  );
}
