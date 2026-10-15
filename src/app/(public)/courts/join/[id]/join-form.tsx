"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { courtMoney, type EquipmentPick, equipmentTotal, HOLD_MINUTES, LEVELS, type PriceItem } from "@/lib/courts";
import { type CourtResult, joinMatch } from "../../actions";
import { EquipmentPicker } from "../../equipment-picker";

export function JoinForm({
  joinKey,
  openMatch,
  levelMin,
  levelMax,
  share,
  currency,
  equipment,
  me,
  online,
}: {
  joinKey: string;
  openMatch: boolean;
  levelMin: number;
  levelMax: number;
  share: number;
  currency: string;
  equipment: PriceItem[];
  me: { name: string; email: string; phone: string } | null;
  online: boolean;
}) {
  const router = useRouter();
  const allowed = LEVELS.filter(([v]) => v >= levelMin && v <= levelMax);
  const [level, setLevel] = useState<number>(allowed[0]?.[0] ?? levelMin);
  const [picks, setPicks] = useState<EquipmentPick[]>([]);
  const pay: "online" | "reception" = online ? "online" : "reception";
  const [result, setResult] = useState<CourtResult | null>(null);
  const [pending, start] = useTransition();
  const due = share + equipmentTotal(equipment, picks);

  return (
    <form
      className="crts-form"
      style={{ boxShadow: "none", padding: 0, maxHeight: "none" }}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const r = await joinMatch({
            key: joinKey,
            name: String(fd.get("name") ?? ""),
            email: String(fd.get("email") ?? ""),
            phone: String(fd.get("phone") ?? ""),
            level: openMatch ? level : null,
            equipment: picks,
            website: String(fd.get("ms_trap_x") ?? ""),
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
      <input name="ms_trap_x" className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" />
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
          <label htmlFor="j-phone">Phone (WhatsApp)</label>
          <input id="j-phone" name="phone" type="tel" required autoComplete="tel" defaultValue={me?.phone ?? ""} />
        </div>
        {openMatch && (
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
        )}
      </div>
      <EquipmentPicker items={equipment} picks={picks} onChange={setPicks} label="Your equipment (you pay for what you take)" />
      <div className="total">
        <span>{due > 0 ? "You pay" : "To pay"}</span>
        <b>{courtMoney(due, currency)}</b>
      </div>
      <p className="muted" style={{ fontSize: 13 }}>
        {due > 0 && pay === "online" && online
          ? `Next, pay by card. Your spot is only yours once you’ve paid; it’s held for ${HOLD_MINUTES} minutes while you do.`
          : due > 0
            ? "You’ll settle it at reception when you arrive."
            : "Nothing to pay. Just add your name to take a spot."}{" "}
        You can leave any time while the match isn’t full, otherwise up to 24 hours before.
      </p>
      <div className="acts">
        <button type="submit" className="btn solid" disabled={pending}>
          {pending ? "One moment…" : due > 0 && pay === "online" && online ? "Continue to payment" : "Join the match"}
        </button>
      </div>
    </form>
  );
}
