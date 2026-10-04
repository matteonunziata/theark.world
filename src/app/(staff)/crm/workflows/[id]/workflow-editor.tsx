"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { resizeImage } from "@/components/cover-field";
import { useToast } from "@/components/toast";
import { CHANNELS, merge } from "@/lib/crm";
import { arkEmail, textToHtml, textToPlain } from "@/lib/email-template";
import { createClient } from "@/lib/supabase/client";
import { aiDraftStep, aiDraftWorkflow, deleteWorkflow, saveWorkflow, type WorkflowStep } from "../../actions";

type Draft = WorkflowStep & { key: number };
type Selected = "start" | "end" | number;

const MERGE = ["{{first_name}}", "{{name}}", "{{org}}"];
const SAMPLE = { name: "Ana Lopez" };

export function WorkflowEditor({
  workflow,
  stats,
  canEdit,
  orgName,
  aiOn,
}: {
  workflow: {
    id: string;
    name: string;
    description: string | null;
    steps: (WorkflowStep & { position: number })[];
  } | null;
  stats: { waiting: number[]; completed: number; active: number };
  canEdit: boolean;
  orgName: string;
  aiOn: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [name, setName] = useState(workflow?.name ?? "");
  const [description, setDescription] = useState(workflow?.description ?? "");
  const [steps, setSteps] = useState<Draft[]>(
    workflow?.steps.length
      ? workflow.steps.map((s, i) => ({ ...s, key: i }))
      : [{ key: 0, channel: "email", delay_days: 0, subject: "", body: "" }],
  );
  const nextKey = useRef(steps.length);
  const [selected, setSelected] = useState<Selected>(workflow ? (steps[0]?.key ?? "start") : "start");
  const [dirty, setDirty] = useState(!workflow);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty || !canEdit) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, canEdit]);

  const change = (fn: () => void) => {
    fn();
    setDirty(true);
  };
  const update = (key: number, patch: Partial<WorkflowStep>) =>
    change(() => setSteps((all) => all.map((s) => (s.key === key ? { ...s, ...patch } : s))));
  const insertAt = (i: number) =>
    change(() => {
      const key = nextKey.current++;
      setSteps((all) => [
        ...all.slice(0, i),
        { key, channel: "email", delay_days: i === 0 ? 0 : 3, subject: "", body: "" },
        ...all.slice(i),
      ]);
      setSelected(key);
    });
  const remove = (key: number) =>
    change(() => {
      const i = steps.findIndex((s) => s.key === key);
      const rest = steps.filter((s) => s.key !== key);
      setSteps(rest);
      setSelected(rest[Math.max(0, i - 1)]?.key ?? "start");
    });
  const move = (key: number, by: -1 | 1) =>
    change(() =>
      setSteps((all) => {
        const i = all.findIndex((s) => s.key === key);
        const j = i + by;
        if (j < 0 || j >= all.length) return all;
        const copy = [...all];
        [copy[i], copy[j]] = [copy[j], copy[i]];
        return copy;
      }),
    );

  const save = () =>
    start(async () => {
      const r = await saveWorkflow({
        id: workflow?.id ?? null,
        name,
        description,
        steps: steps.map(({ channel, delay_days, subject, body }) => ({ channel, delay_days, subject, body })),
      });
      if (!r.ok) {
        toast(r.error ?? "Couldn’t save");
        const bad = r.error?.match(/^Step (\d+)/);
        if (bad) setSelected(steps[Number(bad[1]) - 1]?.key ?? "start");
        else if (!name.trim()) setSelected("start");
        return;
      }
      setDirty(false);
      toast(r.message ?? "Saved");
      if (!workflow && r.id) router.replace(`/crm/workflows/${r.id}`);
      else router.refresh();
    });

  const destroy = () => {
    if (!workflow) return router.push("/crm/workflows");
    if (!confirm(`Delete “${workflow.name}”? Everyone enrolled in it is removed from it.`)) return;
    start(async () => {
      const r = await deleteWorkflow(workflow.id);
      toast(r.ok ? (r.message ?? "") : (r.error ?? ""));
      if (r.ok) router.push("/crm/workflows");
    });
  };

  const idx = typeof selected === "number" ? steps.findIndex((s) => s.key === selected) : -1;
  const step = idx >= 0 ? steps[idx] : null;
  const days = steps.reduce((a, s) => a + Number(s.delay_days || 0), 0);

  return (
    <>
      <div className="wf-bar">
        <Link href="/crm/workflows" className="muted">← Workflows</Link>
        <span className="wf-title">{name || "Untitled workflow"}</span>
        {canEdit && dirty && <span className="tag-sm low">Unsaved changes</span>}
        <span className="spacer" />
        {canEdit && (
          <>
            <button type="button" className="btn ghost" onClick={destroy} disabled={pending}>
              {workflow ? "Delete" : "Discard"}
            </button>
            <button type="button" className="btn primary" onClick={save} disabled={pending || (!dirty && !!workflow)}>
              {pending ? "Saving…" : workflow ? "Save workflow" : "Create workflow"}
            </button>
          </>
        )}
      </div>

      <div className="wf">
        <div className="wf-canvas" role="list" aria-label="Workflow stages">
          <button
            type="button"
            role="listitem"
            className={`wf-node start ${selected === "start" ? "on" : ""}`}
            onClick={() => setSelected("start")}
          >
            <span className="wf-ico">▶</span>
            <span>
              <small>Starts when</small>
              <b>Someone is enrolled from their profile</b>
              <em>{stats.active} active now</em>
            </span>
          </button>

          {steps.map((s, i) => (
            <div key={s.key} className="wf-seg">
              <Connector
                label={
                  i === 0
                    ? Number(s.delay_days) === 0
                      ? "Right away"
                      : `Wait ${s.delay_days} day${Number(s.delay_days) === 1 ? "" : "s"}`
                    : `Wait ${s.delay_days} day${Number(s.delay_days) === 1 ? "" : "s"}`
                }
                onAdd={canEdit ? () => insertAt(i) : undefined}
                onClick={() => setSelected(s.key)}
              />
              <button
                type="button"
                role="listitem"
                className={`wf-node ${s.channel} ${selected === s.key ? "on" : ""} ${!s.body.trim() ? "empty" : ""}`}
                onClick={() => setSelected(s.key)}
              >
                <span className="wf-ico">{s.channel === "whatsapp" ? "✆" : "✉"}</span>
                <span>
                  <small>
                    Step {i + 1} · {s.channel === "whatsapp" ? "WhatsApp" : "Email"}
                  </small>
                  <b>{(s.channel === "email" && s.subject?.trim()) || s.body.trim().split("\n")[0] || "Write this message"}</b>
                  {stats.waiting[i] ? <em>{stats.waiting[i]} waiting here</em> : null}
                </span>
              </button>
            </div>
          ))}

          <Connector label="Then" onAdd={canEdit ? () => insertAt(steps.length) : undefined} />
          <button
            type="button"
            role="listitem"
            className={`wf-node end ${selected === "end" ? "on" : ""}`}
            onClick={() => setSelected("end")}
          >
            <span className="wf-ico">✓</span>
            <span>
              <small>Ends</small>
              <b>Workflow complete</b>
              <em>
                {stats.completed} completed · {steps.length} step{steps.length === 1 ? "" : "s"} over {days} day{days === 1 ? "" : "s"}
              </em>
            </span>
          </button>
        </div>

        <aside className="wf-panel">
          <fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            {selected === "start" && (
              <>
                <h2>Workflow</h2>
                <div className="fld">
                  <label htmlFor="wf-name">Name</label>
                  <input id="wf-name" value={name} onChange={(e) => change(() => setName(e.target.value))} placeholder="e.g. Waitlist welcome" />
                </div>
                <div className="fld">
                  <label htmlFor="wf-desc">Who it’s for</label>
                  <textarea
                    id="wf-desc"
                    rows={3}
                    value={description}
                    onChange={(e) => change(() => setDescription(e.target.value))}
                    placeholder="e.g. New waitlist signups who haven’t applied yet"
                  />
                </div>
                <p className="muted" style={{ fontSize: 13.5 }}>
                  People join this workflow when someone on the team enrolls them from
                  their CRM profile. Each step shows up in the send queue on the day
                  it’s due.
                </p>
                <AiBox
                  id="aiWorkflow"
                  label={steps.some((x) => x.body.trim()) ? "Change the whole workflow with AI" : "Draft the whole workflow with AI"}
                  placeholder="e.g. A 3-step welcome for new founding members: a warm hello on day 0, a WhatsApp check-in on day 3 about their first class, and an email on day 10 inviting them to the members dinner."
                  aiOn={aiOn}
                  run={async (request) => {
                    const r = await aiDraftWorkflow({
                      request,
                      name,
                      description,
                      steps: steps.map(({ channel, delay_days, subject, body }) => ({ channel, delay_days, subject, body })),
                    });
                    if (r.ok && r.workflow) {
                      const w = r.workflow;
                      change(() => {
                        setName(w.name || name);
                        setDescription(w.description || description);
                        const drafted = w.steps.map((x) => ({ ...x, key: nextKey.current++ }));
                        if (drafted.length) setSteps(drafted);
                      });
                    }
                    return r;
                  }}
                />
              </>
            )}

            {selected === "end" && (
              <>
                <h2>Workflow complete</h2>
                <p className="muted" style={{ fontSize: 14 }}>
                  Once every step is sent, the person’s enrollment is marked complete.
                  They stay in the CRM and can be enrolled in another workflow.
                </p>
                {canEdit && (
                  <button type="button" className="btn" onClick={() => insertAt(steps.length)}>
                    Add a step before the end
                  </button>
                )}
              </>
            )}

            {step && (
              <>
                <h2>Step {idx + 1}</h2>
                <div className="seg" role="radiogroup" aria-label="Channel">
                  {CHANNELS.map(([k, l]) => (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={step.channel === k}
                      className={step.channel === k ? "on" : ""}
                      onClick={() => update(step.key, { channel: k })}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <div className="fld">
                  <label htmlFor="wf-delay">{idx === 0 ? "Send after enrolling" : "Wait after the previous step"}</label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      id="wf-delay"
                      type="number"
                      min={0}
                      value={step.delay_days}
                      onChange={(e) => update(step.key, { delay_days: Math.max(0, Number(e.target.value) || 0) })}
                      style={{ width: 90, margin: 0 }}
                    />
                    <span className="muted">day{Number(step.delay_days) === 1 ? "" : "s"}</span>
                  </div>
                </div>
                {step.channel === "email" && (
                  <div className="fld">
                    <label htmlFor="wf-subj">Subject</label>
                    <input id="wf-subj" value={step.subject ?? ""} onChange={(e) => update(step.key, { subject: e.target.value })} />
                  </div>
                )}
                <div className="fld">
                  <label htmlFor="wf-body">Message</label>
                  <textarea
                    id="wf-body"
                    rows={9}
                    value={step.body}
                    onChange={(e) => update(step.key, { body: e.target.value })}
                    placeholder="Hi {{first_name}}, …"
                  />
                  <div className="merge" style={{ marginTop: 6 }}>
                    Insert:{" "}
                    {MERGE.map((m) => (
                      <button
                        key={m}
                        type="button"
                        className="chip-btn"
                        onClick={() => update(step.key, { body: `${step.body}${step.body && !step.body.endsWith(" ") ? " " : ""}${m}` })}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
                {step.channel === "email" && (
                  <FormatBar
                    onInsert={(text) =>
                      update(step.key, { body: `${step.body.replace(/\s*$/, "")}${step.body.trim() ? "\n\n" : ""}${text}` })
                    }
                    onBold={() => update(step.key, { body: `${step.body}${step.body && !/\s$/.test(step.body) ? " " : ""}**bold words**` })}
                  />
                )}
                <AiBox
                  key={step.key}
                  id="aiStep"
                  label={step.body.trim() ? "Rewrite this step with AI" : "Write this step with AI"}
                  placeholder={
                    step.channel === "email"
                      ? "e.g. Make it a short newsletter: a heading, three bullet points on this week’s classes, and a button to the schedule."
                      : "e.g. A friendly two-line check-in asking how their first week went."
                  }
                  aiOn={aiOn}
                  run={async (request) => {
                    const r = await aiDraftStep({
                      request,
                      channel: step.channel,
                      subject: step.subject ?? "",
                      body: step.body,
                      workflowName: name,
                      description,
                      position: idx + 1,
                      total: steps.length,
                    });
                    if (r.ok && r.body !== undefined) {
                      update(step.key, { body: r.body, ...(step.channel === "email" ? { subject: r.subject ?? step.subject } : {}) });
                    }
                    return r;
                  }}
                />
                <Preview step={step} orgName={orgName} />
                {canEdit && (
                  <div className="wf-step-acts">
                    <button type="button" className="btn ghost sm" disabled={idx === 0} onClick={() => move(step.key, -1)}>Move up</button>
                    <button type="button" className="btn ghost sm" disabled={idx === steps.length - 1} onClick={() => move(step.key, 1)}>Move down</button>
                    <span className="spacer" />
                    <button type="button" className="btn danger sm" disabled={steps.length === 1} onClick={() => remove(step.key)}>
                      Remove step
                    </button>
                  </div>
                )}
                {workflow && stats.active > 0 && (
                  <p className="muted" style={{ fontSize: 12.5, marginTop: 12 }}>
                    {stats.active} {stats.active === 1 ? "person is" : "people are"} enrolled. Progress is kept by step number, so
                    adding or moving steps changes what they get next.
                  </p>
                )}
              </>
            )}
          </fieldset>
        </aside>
      </div>
    </>
  );
}

function Connector({ label, onAdd, onClick }: { label: string; onAdd?: () => void; onClick?: () => void }) {
  return (
    <div className="wf-link">
      <span className="line" />
      {onClick ? (
        <button type="button" className="wf-wait" onClick={onClick}>
          {label}
        </button>
      ) : (
        <span className="wf-wait plain">{label}</span>
      )}
      {onAdd && (
        <button type="button" className="wf-add" onClick={onAdd} aria-label="Add a step here" title="Add a step here">
          +
        </button>
      )}
      <span className="line" />
    </div>
  );
}

function Preview({ step, orgName }: { step: WorkflowStep; orgName: string }) {
  const [open, setOpen] = useState(false);
  const body = merge(step.body, SAMPLE, orgName);
  if (!step.body.trim()) return null;
  return (
    <div className="wf-preview">
      <button type="button" className="linkish-sm" onClick={() => setOpen(!open)}>
        {open ? "Hide preview" : step.channel === "email" ? "Preview the email" : "Preview the message"}
      </button>
      {open &&
        (step.channel === "email" ? (
          <iframe
            title="Email preview"
            sandbox=""
            srcDoc={arkEmail({
              origin: window.location.origin,
              orgName,
              body: textToHtml(body),
              footnote: "You’re receiving this because you’re in touch with The ARK. Reply any time.",
            })}
          />
        ) : (
          <div className="wa-bubble">{textToPlain(body)}</div>
        ))}
      {open && <p className="muted" style={{ fontSize: 12, margin: "6px 0 0" }}>Shown for {SAMPLE.name}.</p>}
    </div>
  );
}

function AiBox({
  id,
  label,
  placeholder,
  aiOn,
  run,
}: {
  id: string;
  label: string;
  placeholder: string;
  aiOn: boolean;
  run: (request: string) => Promise<{ ok: boolean; message?: string; error?: string }>;
}) {
  const [request, setRequest] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <div className="ai-box">
      <label htmlFor={id}>{label}</label>
      <textarea id={id} value={request} onChange={(e) => setRequest(e.target.value)} placeholder={placeholder} disabled={!aiOn || busy} />
      <div className="row-b">
        <button
          type="button"
          className="btn"
          disabled={!aiOn || busy || !request.trim()}
          onClick={async () => {
            setBusy(true);
            const r = await run(request);
            setBusy(false);
            toast(r.ok ? (r.message ?? "Drafted") : (r.error ?? "Couldn’t draft that"));
            if (r.ok) setRequest("");
          }}
        >
          {busy ? "Writing…" : "Write it"}
        </button>
        <small>{aiOn ? "You’ll see the draft here before anything is saved or sent." : "Add an Anthropic API key to switch AI on."}</small>
      </div>
    </div>
  );
}

function FormatBar({ onInsert, onBold }: { onInsert: (text: string) => void; onBold: () => void }) {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    setUploading(true);
    try {
      const blob = await resizeImage(file, 1400);
      const path = `${crypto.randomUUID()}.jpg`;
      const { error } = await createClient().storage.from("email").upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/email/${path}`;
      onInsert(`![${file.name.replace(/\.[^.]+$/, "").replace(/[\[\]]/g, "")}](${url})`);
    } catch {
      toast("Couldn’t upload that image. Try a JPG or PNG under 10 MB.");
    }
    setUploading(false);
  }

  return (
    <div className="fmt-bar" role="toolbar" aria-label="Formatting">
      <label className="chip-btn fmt-img">
        {uploading ? "Uploading…" : "Add image"}
        <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </label>
      <button type="button" className="chip-btn" onClick={() => onInsert("## Heading")}>Heading</button>
      <button type="button" className="chip-btn" onClick={onBold}>Bold</button>
      <button type="button" className="chip-btn" onClick={() => onInsert("- First point\n- Second point")}>List</button>
      <button type="button" className="chip-btn" onClick={() => onInsert("[[See the schedule|https://theark.world]]")}>Button</button>
    </div>
  );
}
