"use client";

import { useState, useTransition } from "react";
import { initials } from "@/components/avatar";
import { useToast } from "@/components/toast";
import { avatarUrl } from "@/lib/covers";
import { tierName } from "@/lib/crm";
import { checkInBooking, undoCheckIn } from "./actions";

export type RosterRow = {
  registration_id: string;
  name: string;
  photo_path: string | null;
  tier: string | null;
  is_member: boolean;
  source: string;
  qr_token: string;
  checked_in_at: string | null;
};

export function Roster({
  rows,
  timezone,
  canCheckIn,
  note,
}: {
  rows: RosterRow[];
  timezone: string;
  /** False for sessions on another day; check_in only works on the day. */
  canCheckIn: boolean;
  note?: string;
}) {
  const [state, setState] = useState<Record<string, string | null>>({});
  const at = (r: RosterRow) => (r.registration_id in state ? state[r.registration_id] : r.checked_in_at);
  const done = rows.filter((r) => at(r)).length;

  if (!rows.length) {
    return (
      <div className="empty">
        <h2>Nobody’s booked yet</h2>
        <p>When members book this session, they’ll show up here.</p>
      </div>
    );
  }

  return (
    <>
      <p className="roster-count">
        <b>{done}</b> of {rows.length} checked in
        {note && <span> · {note}</span>}
      </p>
      <div className="roster">
        {rows.map((r) => (
          <Card
            key={r.registration_id}
            r={r}
            at={at(r)}
            timezone={timezone}
            canCheckIn={canCheckIn}
            onChange={(v) => setState((s) => ({ ...s, [r.registration_id]: v }))}
          />
        ))}
      </div>
    </>
  );
}

function Card({
  r,
  at,
  timezone,
  canCheckIn,
  onChange,
}: {
  r: RosterRow;
  at: string | null;
  timezone: string;
  canCheckIn: boolean;
  onChange: (at: string | null) => void;
}) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const photo = avatarUrl(r.photo_path);
  const sub = r.is_member ? (r.tier ? tierName(r.tier) : "Member") : r.source === "public" ? "Guest" : "Added by the team";
  const time = at
    ? new Date(at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: timezone })
    : "";

  function checkIn() {
    start(async () => {
      const res = await checkInBooking(r.qr_token);
      if (res.ok) onChange(res.at ?? new Date().toISOString());
      else toast(res.error ?? "Couldn’t check in. Try again.");
    });
  }
  function undo() {
    start(async () => {
      const res = await undoCheckIn(r.registration_id, r.qr_token);
      if (res.ok) onChange(null);
      else toast(res.error ?? "Couldn’t undo. Try again.");
    });
  }

  return (
    <div className={`rcard ${at ? "in" : ""}`}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="rphoto" src={photo} alt="" />
      ) : (
        <span className="rphoto" aria-hidden="true">
          {initials(r.name)}
        </span>
      )}
      <h3>{r.name}</h3>
      <div className="sub">{sub}</div>
      {at ? (
        <div className="rdone">
          <span>Checked in {time}</span>
          <button type="button" className="linkish-sm" onClick={undo} disabled={pending}>
            Undo
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="btn primary"
          onClick={checkIn}
          disabled={pending || !canCheckIn}
          aria-label={`Check in ${r.name}`}
        >
          {pending ? "Checking in…" : "Check in"}
        </button>
      )}
    </div>
  );
}
