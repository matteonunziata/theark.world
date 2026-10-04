"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import { useDrawer } from "@/components/drawer";
import { useToast } from "@/components/toast";
import type { ActionResult } from "@/lib/action-result";
import {
  mstatusName,
  PIPELINES,
  ptypeName,
  tierClass,
  tierColor,
  tierName,
  tierPrice,
  waLink,
} from "@/lib/crm";
import { dayLabel, fmtDate, todayIn } from "@/lib/dates";
import { nextStep, stepDue } from "@/lib/sequences";
import { addNote, enroll, setStage, updateEnrollment } from "../../actions";
import {
  type Contact,
  ContactDrawer,
  type DiscountOption,
  type Owner,
  type TierOption,
} from "../../contact-drawer";
import {
  type Enrollment,
  MessageDrawer,
  type Sequence,
} from "../../message-drawer";

type Note = { id: string; body: string; created_at: string; author: string | null };

export function ProfileView({
  contact: c,
  notes,
  stages,
  enrollments,
  sequences,
  owners,
  tiers,
  discounts,
  role,
  orgName,
}: {
  contact: Contact;
  notes: Note[];
  stages: { pipeline: string; stage: string }[];
  enrollments: Enrollment[];
  sequences: Sequence[];
  owners: Owner[];
  tiers: TierOption[];
  discounts: DiscountOption[];
  role: string;
  orgName: string;
}) {
  const tierRow = tiers.find((t) => t.key === c.tier);
  const disc = discounts.find((d) => d.id === c.discount_id);
  const toast = useToast();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [seqPick, setSeqPick] = useState("");
  const [editing, setEditing] = useState(false);
  const msg = useDrawer<{ e: Enrollment; seq: Sequence; i: number }>();
  const canEdit = role === "admin" || role === "sales";
  const today = todayIn();

  const run = (fn: () => Promise<ActionResult>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      toast(r.ok ? (r.message ?? "") : (r.error ?? ""));
      if (r.ok) after?.();
    });

  const stageOf = (p: string) => stages.find((s) => s.pipeline === p)?.stage ?? "";

  return (
    <>
      <Link className="ev-back" href="/crm/people">← People</Link>
      <div className="prof-head">
        <Avatar name={c.name} color={tierColor(c.tier)} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1>{c.name}</h1>
          <div className="sub">
            <span className="ptype">
              {ptypeName(c.type)}
              {c.type === "steward" && c.lot ? `, Lot ${c.lot}` : ""}
              {c.resident ? ", lives on-site" : ""}
            </span>
            <span className={`tier ${tierClass(c.tier)}`}>{tierName(c.tier)}</span>
            {c.tier && c.membership_status !== "active" && (
              <span className="ptype">{mstatusName(c.membership_status)}</span>
            )}
          </div>
        </div>
        {canEdit && (
          <button type="button" className="btn" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
      </div>

      <div className="prof-grid">
        <div>
          <section className="panel">
            <h2>Notes</h2>
            {canEdit && (
              <div className="addnote">
                <textarea
                  aria-label="New note"
                  placeholder="Add a note: what you talked about, what they need, what’s next"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <button
                  type="button"
                  className="btn primary"
                  disabled={pending || !note.trim()}
                  onClick={() => run(() => addNote(c.id, note), () => setNote(""))}
                >
                  Add
                </button>
              </div>
            )}
            <div className="notes" style={{ marginTop: 12 }}>
              {notes.length ? (
                notes.map((n) => (
                  <div className="n" key={n.id}>
                    <time>
                      {new Date(n.created_at).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      {n.author ? `, ${n.author}` : ""}
                    </time>
                    <p>{n.body}</p>
                  </div>
                ))
              ) : (
                <p className="muted" style={{ margin: 0 }}>No notes yet.</p>
              )}
            </div>
          </section>

          <section className="panel">
            <h2>Sequences</h2>
            {enrollments.length ? (
              enrollments.map((e) => {
                const seq = sequences.find((s) => s.id === e.sequence_id);
                if (!seq) return null;
                const next = nextStep(seq.steps, e.sent);
                const line =
                  e.status === "stopped"
                    ? "Stopped"
                    : next === -1 || e.status === "completed"
                      ? "Completed"
                      : `Step ${next + 1} of ${seq.steps.length} due ${dayLabel(
                          stepDue(e.started_on, seq.steps, next),
                          today,
                        ).toLowerCase()}`;
                return (
                  <div className="enr" key={e.id}>
                    <b>{seq.name}</b>
                    <span>
                      {e.sent.length} of {seq.steps.length} sent. {line}.
                    </span>
                    {canEdit && (
                      <div className="acts">
                        {e.status === "active" && next >= 0 ? (
                          <>
                            <button
                              type="button"
                              className="btn"
                              onClick={() => msg.openItem({ e, seq, i: next })}
                            >
                              Open step {next + 1}
                            </button>
                            <button
                              type="button"
                              className="btn"
                              disabled={pending}
                              onClick={() => run(() => updateEnrollment(e.id, "stop"))}
                            >
                              Stop
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="btn"
                            disabled={pending}
                            onClick={() => run(() => updateEnrollment(e.id, "remove"))}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="muted" style={{ margin: 0 }}>Not enrolled in any sequence.</p>
            )}
            {canEdit &&
              (sequences.length ? (
                <div className="enroll">
                  <select
                    aria-label="Sequence"
                    value={seqPick}
                    onChange={(e) => setSeqPick(e.target.value)}
                  >
                    <option value="">Enroll in a sequence…</option>
                    {sequences.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn"
                    disabled={pending || !seqPick}
                    onClick={() => run(() => enroll(c.id, seqPick), () => setSeqPick(""))}
                  >
                    Enroll
                  </button>
                </div>
              ) : (
                <p className="note" style={{ marginTop: 10 }}>
                  No sequences yet. <Link href="/crm/sequences">Create one</Link>.
                </p>
              ))}
          </section>
        </div>

        <div>
          <section className="panel">
            <h2>Contact</h2>
            <dl className="kv">
              <dt>Email</dt>
              <dd>{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : "—"}</dd>
              <dt>WhatsApp</dt>
              <dd>
                {c.phone ? (
                  <a href={waLink(c.phone)} target="_blank" rel="noopener noreferrer">
                    {c.phone}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
              <dt>Instagram</dt>
              <dd>
                {c.instagram ? (
                  <a
                    href={`https://instagram.com/${c.instagram.replace("@", "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {c.instagram}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
              <dt>Based in</dt>
              <dd>{c.location || "—"}</dd>
              <dt>How we met</dt>
              <dd>{c.source || "—"}</dd>
              <dt>Owner</dt>
              <dd>{owners.find((o) => o.id === c.owner_id)?.name ?? "—"}</dd>
              {c.tier && (
                <>
                  <dt>Pays</dt>
                  <dd>
                    {tierPrice(tierRow, disc?.percent)}
                    {disc ? ` (${disc.name}, ${Number(disc.percent)}% off)` : ""}
                  </dd>
                  <dt>Member since</dt>
                  <dd>
                    {c.member_since
                      ? fmtDate(c.member_since, { month: "short", day: "numeric", year: "numeric" })
                      : "—"}
                  </dd>
                  <dt>Renews</dt>
                  <dd>
                    {c.renews_on
                      ? fmtDate(c.renews_on, { month: "short", day: "numeric", year: "numeric" })
                      : "—"}
                  </dd>
                </>
              )}
            </dl>
          </section>
          <section className="panel">
            <h2>Interests</h2>
            <div className="tags">
              {c.interests.length ? (
                c.interests.map((i) => <span className="tag" key={i}>{i}</span>)
              ) : (
                <span className="muted">None recorded</span>
              )}
            </div>
          </section>
          <section className="panel">
            <h2>Pipelines</h2>
            <div className="stage-sel">
              {Object.entries(PIPELINES).map(([k, p]) => (
                <span key={k} style={{ display: "contents" }}>
                  <label htmlFor={`st-${k}`}>{p.name}</label>
                  <select
                    id={`st-${k}`}
                    value={stageOf(k)}
                    disabled={!canEdit || pending}
                    onChange={(e) => run(() => setStage(c.id, k, e.target.value || null))}
                  >
                    <option value="">Not in pipeline</option>
                    {p.stages.map(([sk, sl]) => (
                      <option key={sk} value={sk}>{sl}</option>
                    ))}
                  </select>
                </span>
              ))}
            </div>
          </section>
        </div>
      </div>

      <ContactDrawer
        open={editing}
        contact={c}
        owners={owners}
        tiers={tiers}
        discounts={discounts}
        isAdmin={role === "admin"}
        canEdit={canEdit}
        onClose={() => setEditing(false)}
      />
      {msg.item && (
        <MessageDrawer
          key={`${msg.item.e.id}-${msg.item.i}`}
          open={msg.open}
          contact={c}
          orgName={orgName}
          {...msg.item}
          onClose={msg.close}
        />
      )}
    </>
  );
}
