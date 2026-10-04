"use client";

import Link from "next/link";
import { useState } from "react";
import { initials } from "@/components/avatar";
import { CoverField } from "@/components/cover-field";
import { Drawer, useDrawer } from "@/components/drawer";
import type { Tables } from "@/lib/database.types";
import { fmtDate } from "@/lib/dates";
import { age, schoolPhoto } from "@/lib/school";
import { saveStudent } from "./actions";

type Student = Tables<"students"> & { last_update: string | null };

export function StudentsView({ students, today }: { students: Student[]; today: string }) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("");
  const [alumni, setAlumni] = useState(false);
  const drawer = useDrawer<null>();
  const groups = [...new Set(students.map((s) => s.group_name).filter(Boolean) as string[])].sort();
  const needle = q.trim().toLowerCase();
  const active = students.filter((s) => s.status === "active");
  const list = students.filter(
    (s) =>
      (alumni ? s.status === "alumni" : s.status === "active") &&
      (!group || s.group_name === group) &&
      (!needle || `${s.name} ${s.preferred_name ?? ""}`.toLowerCase().includes(needle)),
  );
  const quiet = active.filter(
    (s) => !s.last_update || Date.parse(s.last_update) < Date.parse(`${today}T00:00:00Z`) - 14 * 864e5,
  );

  return (
    <>
      <div className="stats" style={{ marginBottom: 18 }}>
        <div className="stat"><b>{active.length}</b><span>Students</span></div>
        <div className="stat"><b>{groups.length}</b><span>Groups</span></div>
        <div className="stat"><b>{quiet.length}</b><span>No update in two weeks</span></div>
      </div>
      <div className="toolbar">
        <input className="field-in search" type="search" placeholder="Search students" aria-label="Search students" value={q} onChange={(e) => setQ(e.target.value)} />
        {groups.length > 0 && (
          <select className="field-in" aria-label="Group" value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="">All groups</option>
            {groups.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        )}
        <label className="check">
          <input type="checkbox" checked={alumni} onChange={(e) => setAlumni(e.target.checked)} />
          Alumni
        </label>
        <button type="button" className="btn primary" style={{ marginLeft: "auto" }} onClick={drawer.openNew}>
          Add a student
        </button>
      </div>
      {!students.length ? (
        <div className="empty">
          <h2>No students yet</h2>
          <p>
            Add each student with a photo, their group, and a parent’s contact.
            Every student gets a private page their family can open to follow
            along.
          </p>
          <button type="button" className="btn primary" onClick={drawer.openNew}>Add the first student</button>
        </div>
      ) : !list.length ? (
        <div className="empty"><p>No students match.</p></div>
      ) : (
        <div className="students">
          {list.map((s) => {
            const a = age(s.birthdate, today);
            const photo = schoolPhoto(s.photo_path);
            return (
              <Link key={s.id} href={`/arkadia/${s.id}`} className="student-card">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="" />
                ) : (
                  <span className="ph">{initials(s.preferred_name || s.name)}</span>
                )}
                <b>{s.preferred_name ? `${s.preferred_name} (${s.name})` : s.name}</b>
                <span className="muted">{[s.group_name, a !== null ? `${a} years` : null].filter(Boolean).join(" · ") || " "}</span>
                <span className={`last ${s.last_update ? "" : "none"}`}>
                  {s.last_update ? `Last update ${fmtDate(s.last_update.slice(0, 10))}` : "No updates yet"}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      <Drawer
        title="Add a student"
        open={drawer.open}
        onClose={drawer.close}
        action={saveStudent}
        footer={
          <>
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={drawer.close}>Cancel</button>
            <button type="submit" className="btn primary">Add student</button>
          </>
        }
      >
        <div className="fld">
          <span className="lbl">Photo</span>
          <CoverField name="photo_path" bucket="school" />
        </div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="s-name">Full name</label>
            <input id="s-name" name="name" required />
          </div>
          <div className="fld">
            <label htmlFor="s-pref">Goes by</label>
            <input id="s-pref" name="preferred_name" placeholder="Optional" />
          </div>
        </div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="s-group">Group</label>
            <input id="s-group" name="group_name" list="groups" placeholder="e.g. Seeds (4–6)" />
            <datalist id="groups">
              {groups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </div>
          <div className="fld">
            <label htmlFor="s-bday">Birthday</label>
            <input id="s-bday" name="birthdate" type="date" />
          </div>
        </div>
        <div className="fld">
          <label htmlFor="s-start">Started at Arkadia</label>
          <input id="s-start" name="start_date" type="date" defaultValue={today} />
        </div>
        <div className="subhead">A parent or guardian</div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="g-name">Name</label>
            <input id="g-name" name="parent_name" />
          </div>
          <div className="fld">
            <label htmlFor="g-rel">Relation</label>
            <input id="g-rel" name="parent_relation" placeholder="Mother, father, guardian" />
          </div>
        </div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="g-email">Email</label>
            <input id="g-email" name="parent_email" type="email" />
          </div>
          <div className="fld">
            <label htmlFor="g-phone">Phone or WhatsApp</label>
            <input id="g-phone" name="parent_phone" type="tel" />
          </div>
        </div>
        <p className="muted" style={{ fontSize: 13 }}>
          You can add more family members, a longer profile, and notes on the
          student’s page.
        </p>
      </Drawer>
    </>
  );
}
