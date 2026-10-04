"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import { useToast } from "@/components/toast";
import { fmtTime } from "@/lib/dates";
import { checkIn } from "../events/actions";

type Row = {
  id: string;
  name: string;
  qr_token: string;
  checked_in_at: string | null;
  paid: boolean;
  offering: { title: string; start_time: string | null } | null;
  ticket: { name: string; price: number } | null;
};

/** "17:00:00" minus an hour, as "16:00". */
const opensAt = (start: string) => {
  const [h, m] = start.split(":").map(Number);
  const t = Math.max(0, h * 60 + m - 60);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

export function GateView({ rows, now }: { rows: Row[]; now: string }) {
  const [code, setCode] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();

  const clean = code.trim().toUpperCase().replace(/^ARK-?/, "");
  const match = clean.length >= 4
    ? rows.filter((r) => r.qr_token.toUpperCase().endsWith(clean))
    : [];
  const inCount = rows.filter((r) => r.checked_in_at).length;

  const doCheckIn = (token: string) =>
    start(async () => {
      const r = await checkIn(token);
      toast(r.ok ? (r.message ?? "") : (r.error ?? ""));
    });

  return (
    <>
      <div className="toolbar">
        <input
          className="field-in search"
          placeholder="Ticket code, e.g. ARK-4F2A9C"
          aria-label="Ticket code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoCapitalize="characters"
        />
        {match.length === 1 && (
          <Link className="btn primary" href={`/t/${match[0].qr_token}`}>
            Open {match[0].name}’s ticket
          </Link>
        )}
        {clean.length >= 4 && !match.length && (
          <span className="muted">No booking today with that code.</span>
        )}
      </div>
      {!rows.length ? (
        <div className="empty">
          <h2>No bookings today</h2>
          <p>
            Bookings for today’s sessions show here with a check-in button.
            Security can also scan a ticket’s QR code.
          </p>
        </div>
      ) : (
        <>
          <p className="gate-note">
            {inCount} of {rows.length} checked in today.
          </p>
          <div className="list">
            <div className="row head chk">
              <span>Person</span>
              <span className="c-c2">Session</span>
              <span className="c-t">Ticket</span>
              <span />
            </div>
            {rows.map((r) => (
              <div className="row chk static" key={r.id}>
                <span className="who">
                  <Avatar name={r.name} color={r.checked_in_at ? "var(--leaf)" : "var(--slate)"} />
                  <span>
                    <b>{r.name}</b>
                    <span>{r.offering?.title}</span>
                  </span>
                </span>
                <span className="c-c2">
                  {fmtTime(r.offering?.start_time)} {r.offering?.title}
                </span>
                <span className="c-t muted" style={{ fontSize: 13 }}>
                  {r.ticket
                    ? `${r.ticket.name}${Number(r.ticket.price) > 0 && !r.paid ? ", unpaid" : ""}`
                    : "Member"}
                </span>
                <span className="acts">
                  {r.checked_in_at ? (
                    <span className="status on">In</span>
                  ) : r.offering?.start_time && now < opensAt(r.offering.start_time) ? (
                    <span className="muted" style={{ fontSize: 13 }}>
                      Opens {fmtTime(`${opensAt(r.offering.start_time)}:00`)}
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="btn primary"
                      style={{ padding: "6px 10px" }}
                      disabled={pending}
                      onClick={() => doCheckIn(r.qr_token)}
                    >
                      Check in
                    </button>
                  )}
                  <Link className="btn" style={{ padding: "6px 10px" }} href={`/t/${r.qr_token}`}>
                    Ticket
                  </Link>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
