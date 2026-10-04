"use client";

import { useState } from "react";
import { ConfirmButton, Drawer, useDrawer } from "@/components/drawer";
import { CHANNELS } from "@/lib/crm";
import type { Step } from "@/lib/sequences";
import { saveSequence } from "../actions";

type Seq = {
  id: string;
  name: string;
  description: string | null;
  steps: Step[];
  enrolled: number;
};

export function SequencesView({
  sequences,
  canEdit,
}: {
  sequences: Seq[];
  canEdit: boolean;
}) {
  const drawer = useDrawer<Seq>();
  return (
    <>
      <div className="toolbar">
        <span className="muted">
          Email and WhatsApp follow-ups, step by step. Enroll people from their
          profile.
        </span>
        <span className="count" />
        {canEdit && (
          <button type="button" className="btn primary" onClick={drawer.openNew}>
            New sequence
          </button>
        )}
      </div>
      {!sequences.length ? (
        <div className="empty">
          <h2>No sequences yet</h2>
          <p>
            A sequence is a series of messages sent over days or weeks, like a
            waitlist welcome, an application nudge, or a land-buyer follow-up.
          </p>
          {canEdit && (
            <button type="button" className="btn primary" onClick={drawer.openNew}>
              New sequence
            </button>
          )}
        </div>
      ) : (
        <div className="cards">
          {sequences.map((s) => (
            <button
              type="button"
              className="seq-card"
              key={s.id}
              onClick={() => drawer.openItem(s)}
            >
              <h3>{s.name}</h3>
              <p>
                {s.description ? `${s.description} ` : ""}
                {s.enrolled} enrolled.
              </p>
              <div className="steps-line">
                {s.steps.map((st, i) => (
                  <span key={st.position} className={st.channel === "whatsapp" ? "wa" : ""}>
                    {i === 0 ? "Day 0" : `+${st.delay_days}d`}{" "}
                    {st.channel === "whatsapp" ? "WhatsApp" : "Email"}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}
      <SequenceDrawer
        key={drawer.item?.id ?? "new"}
        open={drawer.open}
        seq={drawer.item}
        canEdit={canEdit}
        onClose={drawer.close}
      />
    </>
  );
}

type DraftStep = { key: number } & Partial<Step>;

function SequenceDrawer({
  open,
  seq,
  canEdit,
  onClose,
}: {
  open: boolean;
  seq: Seq | null;
  canEdit: boolean;
  onClose: () => void;
}) {
  const [steps, setSteps] = useState<DraftStep[]>(
    seq?.steps.length
      ? seq.steps.map((s, i) => ({ ...s, key: i }))
      : [{ key: 0, channel: "email", delay_days: 0 }],
  );
  const [nextKey, setNextKey] = useState(steps.length);

  return (
    <Drawer
      title={seq ? "Edit sequence" : "New sequence"}
      open={open}
      onClose={onClose}
      action={saveSequence}
      footer={
        canEdit && (
          <>
            {seq && <ConfirmButton />}
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn primary">
              {seq ? "Save sequence" : "Create sequence"}
            </button>
          </>
        )
      }
    >
      <fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0 }}>
        {seq && <input type="hidden" name="id" value={seq.id} />}
        <div className="fld">
          <label htmlFor="s-name">Sequence name</label>
          <input id="s-name" name="name" defaultValue={seq?.name} placeholder="e.g. Waitlist welcome" required />
        </div>
        <div className="fld">
          <label htmlFor="s-desc">Who it’s for</label>
          <input id="s-desc" name="description" defaultValue={seq?.description ?? ""} placeholder="e.g. New waitlist signups who haven’t applied yet" />
        </div>
        <div className="ai-box">
          <label htmlFor="aiPrompt">Draft or change it with AI</label>
          <textarea id="aiPrompt" disabled placeholder="Describe the sequence, or what to change." />
          <div className="row-b">
            <button type="button" className="btn" disabled>
              Generate steps
            </button>
            <small>AI drafting is switched on in the last build phase.</small>
          </div>
        </div>
        <p className="merge">
          Merge fields: <code>{"{{first_name}}"}</code> <code>{"{{name}}"}</code>{" "}
          <code>{"{{org}}"}</code>
        </p>
        {steps.map((st, i) => (
          <div className="step-ed" key={st.key}>
            <div className="top">
              <span className="lbl">Step {i + 1}</span>
              <select name="s_channel" aria-label="Channel" defaultValue={st.channel ?? "email"}>
                {CHANNELS.map(([k, l]) => (
                  <option key={k} value={k}>{l}</option>
                ))}
              </select>
              <div style={{ display: "flex", gap: 6, alignItems: "center", whiteSpace: "nowrap" }}>
                <input
                  name="s_delay"
                  type="number"
                  min={0}
                  defaultValue={st.delay_days ?? (i === 0 ? 0 : 3)}
                  style={{ width: 64, margin: 0 }}
                  aria-label="Days after previous step"
                />
                <span className="lbl">days {i === 0 ? "after enrolling" : "later"}</span>
                {steps.length > 1 && (
                  <button
                    type="button"
                    className="mini"
                    onClick={() => setSteps(steps.filter((x) => x.key !== st.key))}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
            <input name="s_subject" placeholder="Subject (email only)" defaultValue={st.subject ?? ""} style={{ marginTop: 0 }} />
            <textarea name="s_body" placeholder="Message. Use {{first_name}}, {{name}}, {{org}}" defaultValue={st.body ?? ""} />
          </div>
        ))}
        {canEdit && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              setSteps([...steps, { key: nextKey, channel: "email", delay_days: 3 }]);
              setNextKey(nextKey + 1);
            }}
          >
            Add step
          </button>
        )}
      </fieldset>
    </Drawer>
  );
}
