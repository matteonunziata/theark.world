"use client";

import Link from "next/link";
import {
  useActionState,
  useEffect,
  useEffectEvent,
  useRef,
  useTransition,
} from "react";
import { initials } from "@/components/avatar";
import { CoverField } from "@/components/cover-field";
import { ConfirmButton, Drawer, useDrawer } from "@/components/drawer";
import { useToast } from "@/components/toast";
import type { ActionResult } from "@/lib/action-result";
import type { Tables } from "@/lib/database.types";
import { fmtDate } from "@/lib/dates";
import { age, firstName, schoolPhoto } from "@/lib/school";
import {
  deleteUpdate,
  newFamilyLink,
  postUpdate,
  saveStudent,
  toggleShared,
} from "../actions";
import { FamilyDrawer } from "./family-drawer";

type Student = Tables<"students">;
type Guardian = Tables<"student_guardians">;
type Update = Tables<"student_updates"> & { author: string | null };

export function StudentView({
  s,
  family,
  updates,
  familyUrl,
  today,
  meId,
  isAdmin,
}: {
  s: Student;
  family: Guardian[];
  updates: Update[];
  familyUrl: string;
  today: string;
  meId: string;
  isAdmin: boolean;
}) {
  const edit = useDrawer<null>();
  const fam = useDrawer<Guardian>();
  const toast = useToast();
  const [pending, start] = useTransition();
  const photo = schoolPhoto(s.photo_path);
  const a = age(s.birthdate, today);
  const shown = updates.filter((u) => u.shared).length;

  const run = (p: Promise<ActionResult>) =>
    start(async () => {
      const r = await p;
      toast(r.ok ? (r.message ?? "") : (r.error ?? ""));
    });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(familyUrl);
      toast("Link copied. Send it to the family.");
    } catch {
      toast("Couldn’t copy. Select the link and copy it.");
    }
  };
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(
    `Hi, here’s ${firstName(s)}’s page at Arkadia, where we share updates from school: ${familyUrl}`,
  )}`;

  return (
    <>
      <p style={{ margin: "0 0 14px" }}>
        <Link href="/arkadia" className="muted">← All students</Link>
      </p>
      <div className="student-head">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" />
        ) : (
          <span className="ph">{initials(s.preferred_name || s.name)}</span>
        )}
        <div>
          <h1>{s.preferred_name ? `${s.preferred_name}` : s.name}</h1>
          <p className="lede" style={{ margin: 0 }}>
            {[s.preferred_name ? s.name : null, s.group_name, a !== null ? `${a} years old` : null, s.status === "alumni" ? "Alumni" : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {s.start_date && <p className="muted" style={{ margin: "4px 0 0", fontSize: 13.5 }}>At Arkadia since {fmtDate(s.start_date)}</p>}
        </div>
        <button type="button" className="btn" style={{ marginLeft: "auto", alignSelf: "flex-start" }} onClick={edit.openNew}>
          Edit profile
        </button>
      </div>

      <div className="student-grid">
        <div>
          <Composer studentId={s.id} name={firstName(s)} />
          <h2 className="section-title">Updates</h2>
          {!updates.length ? (
            <div className="empty"><p>No updates yet. Share a moment from {firstName(s)}’s day, a skill they’re working on, or something they made.</p></div>
          ) : (
            <div className="updates">
              {updates.map((u) => (
                <article key={u.id} className={`update ${u.shared ? "" : "private"}`}>
                  <header>
                    <b>{u.author ?? "The ARK team"}</b>
                    <span className="muted">{fmtDate(u.created_at.slice(0, 10))}</span>
                    <span className={`tag-sm ${u.shared ? "" : "low"}`}>{u.shared ? "Family can see" : "Staff only"}</span>
                  </header>
                  <p>{u.body}</p>
                  {u.photo_path && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={schoolPhoto(u.photo_path)!} alt="" loading="lazy" />
                  )}
                  {(u.author_id === meId || isAdmin) && (
                    <footer>
                      <button type="button" className="btn ghost sm" disabled={pending} onClick={() => run(toggleShared(u.id, s.id, !u.shared))}>
                        {u.shared ? "Hide from family" : "Share with family"}
                      </button>
                      <button
                        type="button"
                        className="btn ghost sm"
                        disabled={pending}
                        onClick={() => confirm("Delete this update?") && run(deleteUpdate(u.id, s.id))}
                      >
                        Delete
                      </button>
                    </footer>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className="student-side">
          <section className="card">
            <h2>Family page</h2>
            <p className="muted" style={{ fontSize: 13.5 }}>
              A private page with {firstName(s)}’s profile and the {shown} update{shown === 1 ? "" : "s"} marked
              for the family. Anyone with the link can open it, so send it only to {firstName(s)}’s family.
            </p>
            <input className="field-in" readOnly value={familyUrl} onFocus={(e) => e.target.select()} aria-label="Family page link" style={{ width: "100%", marginBottom: 8 }} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="btn primary sm" onClick={copy}>Copy link</button>
              <a className="btn sm" href={whatsapp} target="_blank" rel="noreferrer">Send on WhatsApp</a>
              <a className="btn ghost sm" href={familyUrl} target="_blank" rel="noreferrer">Preview</a>
            </div>
            <button
              type="button"
              className="linkish-sm"
              disabled={pending}
              onClick={() => confirm("Make a new link? The current one will stop working.") && run(newFamilyLink(s.id))}
            >
              Make a new link
            </button>
          </section>

          <section className="card">
            <h2>Family</h2>
            {family.length ? (
              family.map((g) => (
                <button key={g.id} type="button" className="fam" onClick={() => fam.openItem(g)}>
                  <b>{g.name}</b>
                  {g.relation && <span className="muted"> · {g.relation}</span>}
                  <span className="muted" style={{ display: "block", fontSize: 13 }}>
                    {[g.email, g.phone].filter(Boolean).join(" · ") || "No contact details"}
                  </span>
                </button>
              ))
            ) : (
              <p className="muted" style={{ fontSize: 13.5 }}>No family contacts yet.</p>
            )}
            <button type="button" className="btn ghost sm" onClick={fam.openNew}>Add a family member</button>
          </section>

          {s.about && (
            <section className="card">
              <h2>About {firstName(s)}</h2>
              <p style={{ whiteSpace: "pre-line", fontSize: 14 }}>{s.about}</p>
            </section>
          )}
          {s.staff_notes && (
            <section className="card staff-only">
              <h2>Staff notes</h2>
              <p style={{ whiteSpace: "pre-line", fontSize: 14 }}>{s.staff_notes}</p>
              <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>Never shown to the family.</p>
            </section>
          )}
        </aside>
      </div>

      <Drawer
        title="Edit profile"
        open={edit.open}
        onClose={edit.close}
        action={saveStudent}
        footer={
          <>
            {isAdmin && <ConfirmButton />}
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={edit.close}>Cancel</button>
            <button type="submit" className="btn primary">Save</button>
          </>
        }
      >
        <input type="hidden" name="id" value={s.id} />
        <div className="fld">
          <span className="lbl">Photo</span>
          <CoverField name="photo_path" bucket="school" initial={s.photo_path} />
        </div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="e-name">Full name</label>
            <input id="e-name" name="name" required defaultValue={s.name} />
          </div>
          <div className="fld">
            <label htmlFor="e-pref">Goes by</label>
            <input id="e-pref" name="preferred_name" defaultValue={s.preferred_name ?? ""} />
          </div>
        </div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="e-group">Group</label>
            <input id="e-group" name="group_name" defaultValue={s.group_name ?? ""} />
          </div>
          <div className="fld">
            <label htmlFor="e-bday">Birthday</label>
            <input id="e-bday" name="birthdate" type="date" defaultValue={s.birthdate ?? ""} />
          </div>
        </div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="e-start">Started at Arkadia</label>
            <input id="e-start" name="start_date" type="date" defaultValue={s.start_date ?? ""} />
          </div>
          <div className="fld">
            <label htmlFor="e-status">Status</label>
            <select id="e-status" name="status" defaultValue={s.status}>
              <option value="active">Current student</option>
              <option value="alumni">Alumni</option>
            </select>
          </div>
        </div>
        <div className="fld">
          <label htmlFor="e-about">About (the family sees this)</label>
          <textarea id="e-about" name="about" rows={5} defaultValue={s.about ?? ""} placeholder="What they love, what they’re learning, how they’re growing" />
        </div>
        <div className="fld">
          <label htmlFor="e-notes">Staff notes (never shared)</label>
          <textarea id="e-notes" name="staff_notes" rows={4} defaultValue={s.staff_notes ?? ""} placeholder="Allergies, medical needs, pickup arrangements, anything sensitive" />
        </div>
      </Drawer>

      <FamilyDrawer
        // Remounts on each open, so a new form starts empty.
        key={fam.item?.id ?? `new-${fam.open}`}
        open={fam.open}
        onClose={fam.close}
        studentId={s.id}
        guardian={fam.item}
      />
    </>
  );
}

function Composer({ studentId, name }: { studentId: string; name: string }) {
  const toast = useToast();
  const form = useRef<HTMLFormElement>(null);
  // Each successful post bumps `posted`, which remounts (clears) the photo picker.
  const [state, action, pending] = useActionState(
    async (prev: ActionResult & { posted: number }, data: FormData) => {
      const r = await postUpdate(prev, data);
      return { ...r, posted: prev.posted + (r.ok ? 1 : 0) };
    },
    { ok: false, posted: 0 },
  );

  const onResult = useEffectEvent((r: ActionResult) => {
    if (r.ok && r.message) {
      toast(r.message);
      form.current?.reset();
    } else if (r.error) {
      toast(r.error);
    }
  });
  useEffect(() => onResult(state), [state]);

  return (
    <form ref={form} action={action} className="composer">
      <input type="hidden" name="student_id" value={studentId} />
      <label htmlFor="u-body" className="lbl">Share an update about {name}</label>
      <textarea id="u-body" name="body" rows={3} required placeholder={`What did ${name} explore, make, or discover today?`} />
      <div className="composer-row">
        <CoverField key={state.posted} name="photo_path" bucket="school" />
        <label className="check">
          <input type="checkbox" name="shared" defaultChecked />
          Share with the family
        </label>
        <button type="submit" className="btn primary" disabled={pending} style={{ marginLeft: "auto" }}>
          {pending ? "Posting…" : "Post update"}
        </button>
      </div>
    </form>
  );
}
