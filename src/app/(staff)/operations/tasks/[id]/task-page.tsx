"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import type { ActionResult } from "@/lib/action-result";
import type { Tables } from "@/lib/database.types";
import { fmtDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/client";
import {
  dueClass,
  dueLabel,
  FLOW_STEPS,
  flowStep,
  fmtMinutes,
  fmtStart,
  kindLabel,
  priName,
  STATUSES,
  statusName,
} from "@/lib/tasks";
import { setTaskStatus } from "../../actions";
import {
  addComment,
  addMaterial,
  addPhotos,
  addSubtask,
  clockIn,
  clockOut,
  logTime,
  notifyLead,
  removeMaterial,
  removeSubtask,
  requestBudget,
  reviewBudgetRequest,
  setSubtask,
} from "./actions";

type Photo = Tables<"task_photos"> & { url: string | null };
type Material = Tables<"task_materials"> & { amount: number | null };
type Summary = { hours: number; labour_cost: number; materials_cost: number; bill_amount: number };

const crc = (n: number) => `₡${Math.round(n).toLocaleString("en-US")}`;
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Costa_Rica",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export function TaskPage(p: {
  today: string;
  staffId: string;
  canManage: boolean;
  canReview: boolean;
  task: Tables<"tasks">;
  team: { id: string; name: string }[];
  lotName: string | null;
  amenityName: string | null;
  subtasks: Tables<"task_subtasks">[];
  comments: Tables<"task_comments">[];
  time: Tables<"task_time">[];
  photos: Photo[];
  materials: Material[];
  requests: Tables<"task_budget_requests">[];
  summary: Summary | null;
}) {
  const { task: t } = p;
  const toast = useToast();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      toast(r.ok ? (r.message ?? "Saved") : (r.error ?? "Something went wrong."));
      if (r.ok) after?.();
    });
  const name = (id: string | null) => p.team.find((m) => m.id === id)?.name ?? "Someone";
  const mine = p.time.find((e) => e.staff_id === p.staffId && !e.clock_out) ?? null;
  const sinceIn = (kind: string) =>
    p.photos.filter((x) => x.kind === kind && mine && x.created_at >= mine.clock_in);
  const step = flowStep(!!mine, sinceIn("before").length, sinceIn("after").length);
  const worked = p.time.reduce((s, e) => s + (e.minutes ?? 0), 0);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const isDone = t.status === "done";

  return (
    <div className="tp">
      <p className="tp-back">
        <Link href="/operations/list">← All tasks</Link>
      </p>
      <header className="tp-head">
        <div>
          <span className="tkind">
            {[kindLabel(t.kind), p.lotName, p.amenityName].filter(Boolean).join(", ")}
          </span>
          <h2>{t.title}</h2>
        </div>
        <div className="tp-actions">
          {p.canManage ? (
            <button type="button" className="btn primary" onClick={() => setBudgetOpen(true)}>
              Request budget
            </button>
          ) : (
            <button
              type="button"
              className="btn"
              disabled={pending}
              onClick={() => {
                const note = window.prompt("Anything your lead should know? (optional)") ?? null;
                if (note !== null) run(() => notifyLead(t.id, note));
              }}
            >
              Notify my lead
            </button>
          )}
        </div>
      </header>

      <div className="movebar">
        {STATUSES.map(([k, l]) => (
          <button
            type="button"
            key={k}
            className={`btn ${t.status === k ? "cur" : ""}`}
            aria-pressed={t.status === k}
            disabled={pending}
            onClick={() => t.status !== k && run(() => setTaskStatus(t.id, k))}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="tp-grid">
        <div className="tp-main">
          <section className="panel">
            <h2>On site</h2>
            <ol className="flow" aria-label="Steps">
              {FLOW_STEPS.map(([k, l], i) => (
                <li key={k} className={k === step ? "now" : FLOW_STEPS.findIndex(([x]) => x === step) > i ? "past" : ""}>
                  <i>{i + 1}</i>
                  {l}
                </li>
              ))}
            </ol>
            {isDone && !mine ? (
              <p className="note">This task is done.</p>
            ) : !mine ? (
              <div className="flow-body">
                <p className="muted">Clock in when you get there. You’ll add before photos next.</p>
                <button type="button" className="btn primary" disabled={pending} onClick={() => run(() => clockIn(t.id))}>
                  Clock in
                </button>
              </div>
            ) : (
              <div className="flow-body">
                <p className="muted">Clocked in since {when(mine.clock_in)}.</p>
                <PhotoStep taskId={t.id} kind="before" photos={sinceIn("before")} />
                {step !== "before" && <PhotoStep taskId={t.id} kind="after" photos={sinceIn("after")} />}
                {step === "work" && <p className="muted">Do the work, then add after photos.</p>}
                {step === "clock_out" && (
                  <>
                    <p className="muted">Add the materials you used or bought (below), then clock out.</p>
                    <div className="row-btns">
                      <button type="button" className="btn primary" disabled={pending} onClick={() => run(() => clockOut(t.id, false))}>
                        Clock out
                      </button>
                      <button type="button" className="btn" disabled={pending} onClick={() => run(() => clockOut(t.id, true))}>
                        Clock out and mark done
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            {!isDone && (
              <p className="note" style={{ marginTop: 12 }}>
                {mine ? "Forgot to clock out? " : "Didn’t clock in? "}
                <button type="button" className="linkish" onClick={() => setManualOpen((o) => !o)}>
                  Enter your time and photos by hand
                </button>
              </p>
            )}
            {manualOpen && (
              <ManualTime taskId={t.id} hasOpen={!!mine} onDone={() => setManualOpen(false)} />
            )}
          </section>

          <Photos photos={p.photos} name={name} />
          <Materials taskId={t.id} items={p.materials} canSeeCost={p.canManage} />

          <section className="panel">
            <h2>Subtasks</h2>
            <SubtaskList taskId={t.id} items={p.subtasks} />
          </section>

          <section className="panel">
            <h2>Comments</h2>
            <Comments taskId={t.id} items={p.comments} name={name} />
          </section>
        </div>

        <aside className="tp-side">
          <section className="panel">
            <h2>Details</h2>
            <dl className="kv">
              <dt>Assigned to</dt>
              <dd>{t.assignee_id ? name(t.assignee_id) : "Unassigned"}</dd>
              <dt>Priority</dt>
              <dd>{priName(t.priority)}</dd>
              <dt>Status</dt>
              <dd>{statusName(t.status)}</dd>
              <dt>Date</dt>
              <dd className={dueClass(t.due_date, t.status, p.today)}>
                {t.due_date ? `${dueLabel(t.due_date, p.today)}${t.start_time ? `, ${fmtStart(t.start_time)}` : ""}` : "Not set"}
              </dd>
              <dt>Planned</dt>
              <dd>{t.planned_hours ? `${Number(t.planned_hours)} h` : "Not set"}</dd>
              <dt>Worked</dt>
              <dd>{worked ? fmtMinutes(worked) : "Nothing yet"}</dd>
              <dt>Where</dt>
              <dd>
                {p.amenityName ??
                  (p.lotName && t.lot_id ? <Link href={`/estate/${t.lot_id}?tab=maintenance`}>{p.lotName}</Link> : (t.location ?? "Not set"))}
              </dd>
            </dl>
            {t.description && <p className="tp-desc">{t.description}</p>}
          </section>

          <section className="panel">
            <h2>Time</h2>
            {!p.time.length ? (
              <p className="muted">No time logged yet.</p>
            ) : (
              <ul className="plain">
                {p.time.map((e) => (
                  <li key={e.id}>
                    <b>{name(e.staff_id)}</b>
                    <span className="muted">
                      {" "}
                      {e.clock_out ? fmtMinutes(e.minutes) : "clocked in"} · {fmtDate(e.clock_in.slice(0, 10), { month: "short", day: "numeric" })}
                      {e.manual ? " · typed in" : ""}
                    </span>
                    {e.note && <div className="muted">{e.note}</div>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {p.canManage && (
            <>
              <section className="panel">
                <h2>Cost</h2>
                {p.summary ? (
                  <dl className="kv">
                    <dt>Hours</dt>
                    <dd>{Number(p.summary.hours).toFixed(1)}</dd>
                    <dt>Labour (pay rate)</dt>
                    <dd>{crc(Number(p.summary.labour_cost))}</dd>
                    <dt>Materials</dt>
                    <dd>{crc(Number(p.summary.materials_cost))}</dd>
                    <dt>Total cost</dt>
                    <dd>
                      <b>{crc(Number(p.summary.labour_cost) + Number(p.summary.materials_cost))}</b>
                    </dd>
                    <dt>To bill (bill rate)</dt>
                    <dd>{crc(Number(p.summary.bill_amount))}</dd>
                  </dl>
                ) : (
                  <p className="muted">Nothing to total yet.</p>
                )}
                {t.cost != null && <p className="note">Cost entered on the task: {crc(Number(t.cost))}</p>}
                <p className="note">Only you and admins see this. Set hourly rates in Settings → Team.</p>
              </section>
              <section className="panel">
                <h2>Budget requests</h2>
                {!p.requests.length ? (
                  <p className="muted">None yet.</p>
                ) : (
                  <ul className="plain">
                    {p.requests.map((r) => (
                      <li key={r.id}>
                        <b>{crc(Number(r.amount))}</b> <span className={`status ${r.status === "approved" ? "on" : "off"}`}>{r.status}</span>
                        <div className="muted">{r.reason}</div>
                        <div className="muted">
                          {name(r.requested_by)} · {when(r.requested_at)}
                          {r.review_comment ? ` · ${r.review_comment}` : ""}
                        </div>
                        {r.status === "requested" && p.canReview && (
                          <div className="row-btns">
                            <button type="button" className="btn primary" disabled={pending} onClick={() => run(() => reviewBudgetRequest(t.id, r.id, true, ""))}>
                              Approve
                            </button>
                            <button
                              type="button"
                              className="btn"
                              disabled={pending}
                              onClick={() => {
                                const c = window.prompt("Reason (optional)") ?? null;
                                if (c !== null) run(() => reviewBudgetRequest(t.id, r.id, false, c));
                              }}
                            >
                              Decline
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </aside>
      </div>

      <BudgetModal taskId={t.id} open={budgetOpen} onClose={() => setBudgetOpen(false)} />
    </div>
  );
}

// Photos ------------------------------------------------------------------------------

/** Upload picked files to the private bucket; returns their paths. */
async function uploadPhotos(taskId: string, files: FileList | File[]) {
  const sb = createClient();
  const paths: string[] = [];
  for (const file of Array.from(files)) {
    const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${taskId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await sb.storage.from("task-photos").upload(path, file, { contentType: file.type || undefined });
    if (error) throw new Error("Couldn’t upload a photo. Check your connection and try again.");
    paths.push(path);
  }
  return paths;
}

function PhotoPick({ label, onFiles, busy }: { label: string; onFiles: (f: FileList) => void; busy: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <button type="button" className="btn" disabled={busy} onClick={() => ref.current?.click()}>
        {busy ? "Uploading…" : label}
      </button>
    </>
  );
}

function PhotoStep({ taskId, kind, photos }: { taskId: string; kind: "before" | "after"; photos: Photo[] }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const label = kind === "before" ? "Before photos" : "After photos";
  return (
    <div className="photo-step">
      <b>{label}</b>
      <div className="thumbs">
        {photos.map((x) => (x.url ? <img key={x.id} src={x.url} alt={`${label}`} /> : null))}
        <PhotoPick
          label={photos.length ? "Add more" : `Take or add ${kind} photos`}
          busy={busy}
          onFiles={async (files) => {
            setBusy(true);
            try {
              const paths = await uploadPhotos(taskId, files);
              const r = await addPhotos(taskId, kind, paths);
              toast(r.ok ? (r.message ?? "Added") : (r.error ?? ""));
            } catch (e) {
              toast(e instanceof Error ? e.message : "Couldn’t upload.");
            }
            setBusy(false);
          }}
        />
      </div>
    </div>
  );
}

function Photos({ photos, name }: { photos: Photo[]; name: (id: string | null) => string }) {
  if (!photos.length) return null;
  return (
    <section className="panel">
      <h2>Photos</h2>
      {(["before", "after"] as const).map((k) => {
        const list = photos.filter((x) => x.kind === k && x.url);
        return list.length ? (
          <div key={k} className="photo-group">
            <b>{k === "before" ? "Before" : "After"}</b>
            <div className="thumbs">
              {list.map((x) => (
                <a key={x.id} href={x.url ?? "#"} target="_blank" rel="noreferrer" title={`${name(x.uploaded_by)}, ${when(x.created_at)}${x.manual ? ", added by hand" : ""}`}>
                  <img src={x.url ?? ""} alt={`${k} photo`} />
                </a>
              ))}
            </div>
          </div>
        ) : null;
      })}
    </section>
  );
}

// The by-hand form ----------------------------------------------------------------------

function ManualTime({ taskId, hasOpen, onDone }: { taskId: string; hasOpen: boolean; onDone: () => void }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");
  const [before, setBefore] = useState<string[]>([]);
  const [after, setAfter] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const add = (kind: "before" | "after") => async (files: FileList) => {
    setBusy(true);
    try {
      const paths = await uploadPhotos(taskId, files);
      (kind === "before" ? setBefore : setAfter)((cur) => [...cur, ...paths]);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn’t upload.");
    }
    setBusy(false);
  };
  const save = (finish: boolean) =>
    start(async () => {
      const r = await logTime(taskId, hours, note, before, after, finish);
      toast(r.ok ? (r.message ?? "Saved") : (r.error ?? ""));
      if (r.ok) onDone();
    });
  return (
    <div className="manual">
      <div className="fld">
        <label htmlFor="mt-h">How long did you work? (hours, like 1.5 or 1:30)</label>
        <input id="mt-h" value={hours} onChange={(e) => setHours(e.target.value)} inputMode="decimal" />
      </div>
      <div className="fld">
        <label htmlFor="mt-n">Note (optional)</label>
        <input id="mt-n" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="photo-step">
        <b>Before photos ({before.length})</b>
        <PhotoPick label="Add before photos" busy={busy} onFiles={add("before")} />
      </div>
      <div className="photo-step">
        <b>After photos ({after.length})</b>
        <PhotoPick label="Add after photos" busy={busy} onFiles={add("after")} />
      </div>
      <p className="note">
        {hasOpen
          ? "This closes your open clock-in with the time you enter."
          : "This records the time as ending now."}
      </p>
      <div className="row-btns">
        <button type="button" className="btn primary" disabled={pending || busy} onClick={() => save(false)}>
          Save time
        </button>
        <button type="button" className="btn" disabled={pending || busy} onClick={() => save(true)}>
          Save and mark done
        </button>
      </div>
    </div>
  );
}

// Materials, subtasks, comments -----------------------------------------------------------

function Materials({ taskId, items, canSeeCost }: { taskId: string; items: Material[]; canSeeCost: boolean }) {
  const toast = useToast();
  const [source, setSource] = useState("used");
  const [state, action, pending] = useActionState(addMaterial.bind(null, taskId), { ok: false } as ActionResult);
  const form = useRef<HTMLFormElement>(null);
  const [, start] = useTransition();
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);
  return (
    <section className="panel">
      <h2>Materials</h2>
      {items.length > 0 && (
        <ul className="plain">
          {items.map((m) => (
            <li key={m.id} className="split">
              <span>
                {Number(m.quantity)}
                {m.unit ? ` ${m.unit}` : ""} {m.name} <span className="muted">· {m.source}</span>
                {canSeeCost && m.amount != null ? <span className="muted"> · {crc(m.amount)}</span> : null}
              </span>
              <button
                type="button"
                className="linkish"
                onClick={() =>
                  start(async () => {
                    const r = await removeMaterial(taskId, m.id);
                    if (!r.ok) toast(r.error ?? "");
                  })
                }
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <form ref={form} action={action} className="mat-form">
        <input name="name" placeholder="What (e.g. PVC glue)" aria-label="Material" required />
        <input name="quantity" type="number" min="0.01" step="any" defaultValue={1} aria-label="Quantity" />
        <input name="unit" placeholder="Unit" aria-label="Unit" />
        <select name="source" value={source} onChange={(e) => setSource(e.target.value)} aria-label="Used or bought">
          <option value="used">Used (from stock)</option>
          <option value="bought">Bought</option>
        </select>
        {source === "bought" && <input name="amount" type="number" min="0" step="any" placeholder="Paid (₡)" aria-label="Amount paid" />}
        <button type="submit" className="btn" disabled={pending}>
          Add
        </button>
      </form>
      {!state.ok && state.error && <p className="form-error">{state.error}</p>}
    </section>
  );
}

function SubtaskList({ taskId, items }: { taskId: string; items: Tables<"task_subtasks">[] }) {
  const toast = useToast();
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast(r.error ?? "");
      else after?.();
    });
  return (
    <>
      {items.length > 0 && (
        <ul className="plain">
          {items.map((s) => (
            <li key={s.id} className="split">
              <label className="check">
                <input type="checkbox" checked={s.done} disabled={pending} onChange={(e) => run(() => setSubtask(taskId, s.id, e.target.checked))} />
                <span style={s.done ? { textDecoration: "line-through", opacity: 0.6 } : undefined}>{s.title}</span>
              </label>
              <button type="button" className="linkish" onClick={() => run(() => removeSubtask(taskId, s.id))}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="inline-add"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) run(() => addSubtask(taskId, draft), () => setDraft(""));
        }}
      >
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a subtask" aria-label="New subtask" />
        <button type="submit" className="btn" disabled={pending}>
          Add
        </button>
      </form>
    </>
  );
}

function Comments({ taskId, items, name }: { taskId: string; items: Tables<"task_comments">[]; name: (id: string | null) => string }) {
  const toast = useToast();
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();
  return (
    <>
      {items.length > 0 && (
        <ul className="plain comments">
          {items.map((c) => (
            <li key={c.id} className={c.kind === "lead_ping" ? "ping" : ""}>
              <b>{name(c.author_id)}</b> <span className="muted">{when(c.created_at)}{c.kind === "lead_ping" ? " · asked their lead" : ""}</span>
              <div>{c.body}</div>
            </li>
          ))}
        </ul>
      )}
      <form
        className="inline-add"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          start(async () => {
            const r = await addComment(taskId, draft);
            if (r.ok) setDraft("");
            else toast(r.error ?? "");
          });
        }}
      >
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a comment" aria-label="New comment" />
        <button type="submit" className="btn" disabled={pending}>
          Post
        </button>
      </form>
    </>
  );
}

// Request budget (leads) -------------------------------------------------------------------

function BudgetModal({ taskId, open, onClose }: { taskId: string; open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const toast = useToast();
  const [state, action, pending] = useActionState(requestBudget.bind(null, taskId), { ok: false } as ActionResult);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  useEffect(() => {
    if (state.ok && state.message) {
      toast(state.message);
      onClose();
    }
    // biome-ignore lint/correctness/useExhaustiveDependencies: close once per result
  }, [state]);
  return (
    <dialog ref={ref} className="modal" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      {open && (
        <form action={action}>
          <h2>Request budget</h2>
          <p className="muted">An admin reviews this. It isn’t paid from here.</p>
          {!state.ok && state.error && <div className="form-error" role="alert">{state.error}</div>}
          <div className="fld">
            <label htmlFor="br-amount">Amount (₡)</label>
            <input id="br-amount" name="amount" type="number" min="1" step="any" required />
          </div>
          <div className="fld">
            <label htmlFor="br-reason">What it’s for</label>
            <textarea id="br-reason" name="reason" required placeholder="Materials, a contractor, equipment…" />
          </div>
          <div className="row-btns">
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={pending}>
              Send request
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
