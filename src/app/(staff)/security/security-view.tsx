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

type GuestRow = { guest_name: string; host_name: string; token: string; status: string; used_at: string | null };

export function SecurityView({ rows, now, guests }: { rows: Row[]; now: string; guests: GuestRow[] }) {
  const [code, setCode] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();

  const isGuest = /^GST/i.test(code.trim());
  const clean = code.trim().toUpperCase().replace(/^(ARK|GST)-?/, "");
  const match = clean.length >= 4 && !isGuest
    ? rows.filter((r) => r.qr_token.toUpperCase().endsWith(clean))
    : [];
  const guestMatch = clean.length >= 4
    ? guests.filter((g) => g.token.toUpperCase().endsWith(clean))
    : [];
  const guestsIn = guests.filter((g) => g.status === "used").length;
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
          placeholder="Code under the QR, e.g. ARK-4F2A9C"
          aria-label="Ticket code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoCapitalize="characters"
        />
        {match.length === 1 && (
          <Link className="btn primary" href={`/t/${match[0].qr_token}`}>
            Check in {match[0].name}
          </Link>
        )}
        {guestMatch.length === 1 && (
          <Link className="btn primary" href={`/g/${guestMatch[0].token}`}>
            Let {guestMatch[0].guest_name} in
          </Link>
        )}
        {clean.length >= 4 && !match.length && !guestMatch.length && (
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
                  <Link className="btn" style={{ padding: "6px 10px" }} href={`/t/${r.qr_token}?look=1`}>
                    Ticket
                  </Link>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      <h2 className="section-title" style={{ marginTop: 28 }}>Guests today</h2>
      {!guests.length ? (
        <p className="muted">No guest passes for today.</p>
      ) : (
        <>
          <p className="gate-note">{guestsIn} of {guests.length} guests have arrived.</p>
          <div className="list">
            {guests.map((g) => (
              <div className="row chk static" key={g.token}>
                <span className="who">
                  <Avatar name={g.guest_name} color={g.status === "used" ? "var(--leaf)" : "var(--slate)"} />
                  <span>
                    <b>{g.guest_name}</b>
                    <span>Guest of {g.host_name}</span>
                  </span>
                </span>
                <span className="c-c2 muted">Guest of {g.host_name}</span>
                <span className="c-t muted" style={{ fontSize: 13 }}>Guest pass</span>
                <span className="acts">
                  {g.status === "used" ? (
                    <span className="status on">In</span>
                  ) : (
                    <Link className="btn primary" style={{ padding: "6px 10px" }} href={`/g/${g.token}`}>
                      Let in
                    </Link>
                  )}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
