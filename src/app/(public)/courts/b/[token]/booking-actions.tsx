"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import type { EquipmentPick, PriceItem } from "@/lib/courts";
import { addCourtEquipment, cancelCourt, freeStarts, moveCourt } from "../../actions";
import { EquipmentPicker } from "../../equipment-picker";
import { MoveForm } from "../../move-form";

/** A link to copy, with a label. */
export function CopyLink({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt("Copy this link", url);
        }
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}

/** Leave a match (a player). */
export function LeaveMatch({ token }: { token: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className="btn quiet"
        disabled={pending}
        onClick={() => {
          if (!confirm("Leave this match?")) return;
          start(async () => {
            const r = await cancelCourt(token);
            if (!r.ok) setError(r.error ?? "Couldn’t leave.");
            else router.refresh();
          });
        }}
      >
        {pending ? "One moment…" : "Leave the match"}
      </button>
      {error && <span className="muted" role="alert" style={{ fontSize: 13.5, alignSelf: "center" }}>{error}</span>}
    </>
  );
}

/**
 * Move or cancel the booking with its private link. The person confirms the
 * phone number used on the booking first; the database checks it again.
 */
export function ManageBooking({
  token,
  bookingId,
  courtId,
  current,
  today,
  last,
  prices,
  movable,
  movesLeft,
  cancellable,
}: {
  token: string;
  bookingId: string;
  courtId: string;
  current: { date: string; start: string; minutes: number };
  today: string;
  last: string;
  prices: Record<number, number>;
  movable: boolean;
  movesLeft: number;
  cancellable: boolean;
}) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [mode, setMode] = useState<"move" | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const loadStarts = useCallback((d: string, m: number) => freeStarts(courtId, d, m, bookingId), [courtId, bookingId]);

  if (!movable && !cancellable) {
    return (
      <p className="muted" style={{ fontSize: 13.5 }}>
        This booking can no longer be moved or cancelled online. Message us if you need a change.
      </p>
    );
  }

  if (!confirmed) {
    return (
      <div className="manage-form">
        <div className="fld">
          <label htmlFor="mg-phone">Phone number on the booking</label>
          <input id="mg-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="The number you booked with" autoComplete="tel" />
        </div>
        <button type="button" className="btn solid" disabled={phone.replace(/\D/g, "").length < 6} onClick={() => setConfirmed(true)}>
          Continue
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="acts" style={{ marginTop: 0 }}>
        {movable && (
          <button type="button" className="btn" onClick={() => setMode(mode === "move" ? null : "move")}>
            Move to another time
          </button>
        )}
        {cancellable && (
          <button
            type="button"
            className="btn quiet"
            disabled={pending}
            onClick={() => {
              if (!confirm("Cancel this booking?")) return;
              start(async () => {
                const r = await cancelCourt(token, phone);
                if (!r.ok) setError(r.error ?? "Couldn’t cancel.");
                else router.refresh();
              });
            }}
          >
            {pending ? "One moment…" : "Cancel booking"}
          </button>
        )}
      </div>
      {error && <p role="alert" className="muted" style={{ fontSize: 13.5 }}>{error}</p>}
      {mode === "move" && (
        <MoveForm
          current={current}
          today={today}
          last={last}
          prices={prices}
          movesLeft={movesLeft}
          loadStarts={loadStarts}
          onMove={async (d, s, m) => {
            const r = await moveCourt(token, phone, d, s, m);
            if (r.ok) router.refresh();
            return r;
          }}
        />
      )}
    </div>
  );
}

/** Add equipment for yourself; you pay for what you take. */
export function AddEquipment({ token, items }: { token: string; items: PriceItem[] }) {
  const router = useRouter();
  const [picks, setPicks] = useState<EquipmentPick[]>([]);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!items.some((i) => i.kind === "equipment")) return null;
  return (
    <div>
      <EquipmentPicker items={items} picks={picks} onChange={setPicks} label="Add equipment" />
      <button
        type="button"
        className="btn sm"
        disabled={pending || !picks.length}
        onClick={() =>
          start(async () => {
            const r = await addCourtEquipment(token, picks);
            if (!r.ok) setError(r.error ?? "Couldn’t add that.");
            else {
              setPicks([]);
              setError(null);
              router.refresh();
            }
          })
        }
      >
        {pending ? "One moment…" : "Add to my booking"}
      </button>
      {error && <span role="alert" className="muted" style={{ fontSize: 13.5, marginLeft: 10 }}>{error}</span>}
    </div>
  );
}
