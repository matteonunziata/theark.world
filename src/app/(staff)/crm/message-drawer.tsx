"use client";

import { useState } from "react";
import { Drawer } from "@/components/drawer";
import { useToast } from "@/components/toast";
import { CHANNELS, merge, waLink } from "@/lib/crm";
import type { Step } from "@/lib/sequences";
import { markSent, sendStep } from "./actions";
import type { Contact } from "./contact-drawer";

export type Enrollment = {
  id: string;
  sequence_id: string;
  started_on: string;
  status: string;
  sent: number[];
};
export type Sequence = { id: string; name: string; steps: Step[] };

/** One sequence step, merged for a person, ready to copy or open. */
export function MessageDrawer({
  open,
  contact: c,
  orgName,
  e,
  seq,
  i,
  onClose,
}: {
  open: boolean;
  contact: Pick<Contact, "name" | "email" | "phone">;
  orgName: string;
  e: Enrollment;
  seq: Sequence;
  i: number;
  onClose: () => void;
}) {
  const st = seq.steps[i];
  const body = merge(st.body, c, orgName);
  const subject = merge(st.subject, c, orgName);
  const wa = st.channel === "whatsapp";
  const link = wa
    ? waLink(c.phone, body)
    : c.email
      ? `mailto:${c.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
      : "";
  const toast = useToast();
  const [sending, setSending] = useState(false);

  return (
    <Drawer
      title={`${seq.name}, step ${i + 1}`}
      open={open}
      onClose={onClose}
      action={() => markSent(e.id, st.position)}
      footer={
        <>
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={onClose}>
            Close
          </button>
          <button type="submit" className="btn primary">
            Mark as sent
          </button>
        </>
      }
    >
      <p className="muted" style={{ marginTop: 0 }}>
        {CHANNELS.find(([k]) => k === st.channel)?.[1]} to {c.name}
        {wa
          ? c.phone
            ? `, ${c.phone}`
            : ", no number on file"
          : c.email
            ? `, ${c.email}`
            : ", no email on file"}
      </p>
      {!wa && subject && (
        <div className="fld">
          <label htmlFor="msgSubj">Subject</label>
          <input id="msgSubj" readOnly value={subject} />
        </div>
      )}
      <div className="fld">
        <label htmlFor="msgBody">Message</label>
        <textarea id="msgBody" readOnly value={body} style={{ minHeight: 180 }} />
      </div>
      <div className="share">
        <button
          type="button"
          className="btn"
          onClick={() =>
            navigator.clipboard.writeText(body).then(
              () => toast("Copied"),
              () => toast("Select the message and copy it"),
            )
          }
        >
          Copy message
        </button>
        {link && (
          <a className="btn" href={link} target="_blank" rel="noopener noreferrer">
            Open in {wa ? "WhatsApp" : "email"}
          </a>
        )}
        {!wa && c.email && (
          <button
            type="button"
            className="btn primary"
            disabled={sending}
            onClick={async () => {
              setSending(true);
              const r = await sendStep(e.id, st.position);
              setSending(false);
              toast(r.ok ? (r.message ?? "Sent") : (r.error ?? "Couldn’t send"));
              if (r.ok) onClose();
            }}
          >
            {sending ? "Sending…" : "Send in ARK template"}
          </button>
        )}
      </div>
    </Drawer>
  );
}
