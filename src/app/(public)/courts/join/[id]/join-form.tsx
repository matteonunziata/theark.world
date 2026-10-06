"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { courtMoney, HOLD_MINUTES, LEVELS } from "@/lib/courts";
import { type CourtResult, joinMatch } from "../../actions";

export function JoinForm({
  bookingId,
  levelMin,
  levelMax,
  share,
  currency,
  me,
  isMember,
  online,
}: {
  bookingId: string;
  levelMin: number;
  levelMax: number;
  share: number;
  currency: string;
  me: { name: string; email: string; phone: string } | null;
  isMember: boolean;
  online: boolean;
}) {
  const router = useRouter();
  const allowed = LEVELS.filter(([v]) => v >= levelMin && v <= levelMax);
  const [level, setLevel] = useState<number>(allowed[0]?.[0] ?? levelMin);
  const [pay, setPay] = useState<"online" | "reception">(online ? "online" : "reception");
  const [result, setResult] = useState<CourtResult | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="crts-form"
      style={{ boxShadow: "none", padding: 0, maxHeight: "none" }}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const r = await joinMatch({
            bookingId,
            name: String(fd.get("name") ?? ""),
            email: String(fd.get("email") ?? ""),
            phone: String(fd.get("phone") ?? ""),
            level,
            pay,
            website: String(fd.get("website") ?? ""),
          });
          setResult(r);
          if (r.ok) {
            if (r.payUrl) window.location.assign(r.payUrl);
            else router.push(`/courts/b/${r.token}`);
          }
        });
      }}
    >
      {result && !result.ok && (
        <div className="err" role="alert">
          {result.error}
        </div>
      )}
      <input name="website" className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <div className="two">
        <div className="fld">
          <label htmlFor="j-name">Your name</label>
          <input id="j-name" name="name" required autoComplete="name" defaultValue={me?.name ?? ""} />
        </div>
        <div className="fld">
          <label htmlFor="j-email">Email</label>
          <input id="j-email" name="email" type="email" required autoComplete="email" defaultValue={me?.email ?? ""} readOnly={!!me?.email} />
        </div>
      </div>
      <div className="two">
        <div className="fld">
          <label htmlFor="j-phone">WhatsApp (optional)</label>
          <input id="j-phone" name="phone" type="tel" autoComplete="tel" defaultValue={me?.phone ?? ""} />
        </div>
        <div className="fld">
          <label htmlFor="j-level">Your level</label>
          <select id="j-level" value={level} onChange={(e) => setLevel(Number(e.target.value))}>
            {allowed.map(([v, name]) => (
              <option key={v} value={v}>
                {v} · {name}
              </option>
            ))}
          </select>
          <span className="hint">
            This match is for levels {levelMin} to {levelMax}.
          </span>
        </div>
      </div>
      {online && isMember && share > 0 && (
        <fieldset>
          <legend>Payment</legend>
          <div className="opts">
            <label className={pay === "online" ? "on" : ""}>
              <input type="radio" name="pay" checked={pay === "online"} onChange={() => setPay("online")} />
              <b>Pay by card now</b>
              <span>You’re in right away</span>
            </label>
            <label className={pay === "reception" ? "on" : ""}>
              <input type="radio" name="pay" checked={pay === "reception"} onChange={() => setPay("reception")} />
              <b>Settle at reception</b>
              <span>Members only</span>
            </label>
          </div>
        </fieldset>
      )}
      <div className="total">
        <span>Your share</span>
        <b>{courtMoney(share, currency)}</b>
      </div>
      <p className="muted" style={{ fontSize: 13 }}>
        {share > 0 && pay === "online" && online
          ? `Next, pay by card. Your spot is held for ${HOLD_MINUTES} minutes while you do.`
          : share > 0
            ? "You’ll settle it at reception when you arrive."
            : "Nothing to pay."}{" "}
        You can leave any time while the match isn’t full, otherwise up to 24 hours before.
      </p>
      <div className="acts">
        <button type="submit" className="btn solid" disabled={pending}>
          {pending ? "One moment…" : share > 0 && pay === "online" && online ? "Continue to payment" : "Join the match"}
        </button>
      </div>
    </form>
  );
}
