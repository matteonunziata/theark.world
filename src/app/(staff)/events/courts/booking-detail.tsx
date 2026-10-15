"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Drawer } from "@/components/drawer";
import { useToast } from "@/components/toast";
import type { Tables } from "@/lib/database.types";
import { courtMoney, hhmm, levelRange } from "@/lib/courts";
import { fmtDate } from "@/lib/dates";
import { courtAction } from "./actions";
import { METHODS, methodName, type SBooking, type SPlayer } from "./staff-types";

type Court = Tables<"courts">;
type Price = Tables<"court_prices">;

const crc = (n: number) => courtMoney(Math.round(n), "CRC");

/**
 * One booking, for the community manager: who is playing, what each person owes
 * and has paid, equipment, check-in, taking payment, and starting the game.
 * Staff only: nothing here is ever sent to members or the public.
 */
export function BookingDetail({
  booking: b,
  court,
  date,
  equipment,
  usdRate,
  onClose,
}: {
  booking: SBooking;
  court?: Court;
  date: string;
  equipment: Price[];
  usdRate: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);

  const run = (op: Parameters<typeof courtAction>[0], after?: () => void) =>
    start(async () => {
      const r = await courtAction(op);
      if (!r.ok) {
        setError(r.error ?? "Something went wrong.");
        return;
      }
      setError(null);
      if (r.message) toast(r.message);
      after?.();
      router.refresh();
    });

  const title = court ? `${court.name}, ${hhmm(b.start_time)}–${hhmm(b.end_time)}` : "Court booking";

  if (b.kind === "class") {
    return (
      <Drawer
        title={title}
        open
        onClose={onClose}
        footer={
          <>
            {armed ? (
              <button type="button" className="btn danger armed" disabled={pending} onClick={() => run({ type: "cancel", booking: b.id }, onClose)}>
                Confirm release
              </button>
            ) : (
              <button type="button" className="btn danger" onClick={() => setArmed(true)}>Release court</button>
            )}
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={onClose}>Close</button>
          </>
        }
      >
        <p style={{ marginTop: 0 }}>
          <b>{b.name}</b>
          <br />
          <span className="muted">{fmtDate(date, { weekday: "long", month: "long", day: "numeric" })}, {hhmm(b.start_time)}–{hhmm(b.end_time)}</span>
        </p>
        <p className="muted">This court is blocked for a class. The public can’t book it. Releasing it makes it available again.</p>
        {error && <div className="form-error" role="alert">{error}</div>}
      </Drawer>
    );
  }

  const inPlayers = b.players.filter((p) => p.status === "in");
  const listed = b.players.length;
  const spotsLeft = Math.max(0, b.spots - listed);
  const share = b.private_pay === "whole" ? 0 : Math.round(b.amount / b.spots);
  const named = inPlayers.filter((p) => p.named).length;
  const checked = inPlayers.filter((p) => p.checked_in_at).length;
  const paying = b.players.filter((p) => p.status === "held").length;
  const problems: string[] = [];
  if (named < b.spots) problems.push(`${named} of ${b.spots} players named`);
  if (checked < inPlayers.length || inPlayers.length < b.spots) problems.push(`${checked} of ${b.spots} checked in`);
  if (paying) problems.push("someone is still paying");
  if (b.owed > 0) problems.push(`${crc(b.owed)} still owed`);
  const ready = problems.length === 0;
  const kind = b.open_match
    ? `Open match, level ${levelRange(b.level_min, b.level_max)}`
    : b.private_pay === "whole"
      ? "Private, booker pays the whole court"
      : "Private, split between players";

  return (
    <Drawer
      title={title}
      open
      onClose={onClose}
      footer={
        <>
          {b.started_at ? null : armed ? (
            <button type="button" className="btn danger armed" disabled={pending} onClick={() => run({ type: "cancel", booking: b.id }, onClose)}>
              Confirm cancel
            </button>
          ) : (
            <button type="button" className="btn danger" onClick={() => setArmed(true)}>Cancel booking</button>
          )}
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={onClose}>Close</button>
        </>
      }
    >
      {error && <div className="form-error" role="alert">{error}</div>}

      <section className="cd-sec">
        <p style={{ margin: "0 0 4px" }}>
          <span className={`cd-state ${b.state === "green" ? "green" : "red"}`}>
            {b.state === "green" ? "Fully paid" : `${crc(b.owed)} owed`}
          </span>{" "}
          {b.started_at && <span className="cd-state green">Game started</span>}
        </p>
        <p className="muted" style={{ margin: 0 }}>
          {fmtDate(date, { weekday: "long", month: "long", day: "numeric" })} · {kind} · {b.spots} players
        </p>
        <p className="muted" style={{ margin: "4px 0 0" }}>
          Booked by {b.name}
          {b.phone ? ` · ${b.phone}` : " · no phone"}
          {b.email ? ` · ${b.email}` : ""} · {b.source === "web" ? "website" : b.source}
        </p>
        {b.notes && <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{b.notes}</p>}
        <table className="cd-table" style={{ marginTop: 10 }}>
          <tbody>
            <tr><td>Court</td><td>{crc(b.amount)}</td></tr>
            <tr><td>Equipment</td><td>{crc(b.equipment_total)}</td></tr>
            <tr><td>Paid</td><td>{crc(b.paid_total)}</td></tr>
            <tr><td><b>Owed</b></td><td><b className={b.owed > 0 ? "cd-owe bad" : "cd-owe"}>{crc(Math.max(b.owed, 0))}</b></td></tr>
          </tbody>
        </table>
        {b.credit > 0 && (
          <p className="hint" style={{ color: "var(--danger)" }}>
            Credit of {crc(b.credit)} to settle with the booker (moved to a shorter time).
          </p>
        )}
        {b.moves_used > 0 && <p className="hint">Moved {b.moves_used} time{b.moves_used === 1 ? "" : "s"}.</p>}
      </section>

      <section className="cd-sec">
        <h3>Players</h3>
        {b.players.map((p) => (
          <PlayerCard key={p.id} p={p} b={b} pending={pending} run={run} />
        ))}
        {spotsLeft > 0 && (
          <p className="muted" style={{ fontSize: 13.5 }}>
            {spotsLeft} spot{spotsLeft === 1 ? "" : "s"} not filled
            {share > 0 ? `: ${crc(share * spotsLeft)} owed for them. Collect it from the players who showed up, or add the player below.` : "."}
          </p>
        )}
        {spotsLeft > 0 && <AddPlayer bookingId={b.id} pending={pending} run={run} />}
      </section>

      {!b.started_at && (
        <>
          <section className="cd-sec">
            <h3>Equipment</h3>
            <AddEquipment b={b} equipment={equipment} pending={pending} run={run} />
          </section>

          <section className="cd-sec">
            <h3>Take payment</h3>
            {b.owed > 0 ? (
              <TakePayment b={b} usdRate={usdRate} pending={pending} run={run} />
            ) : (
              <p className="muted">Nothing is owed.</p>
            )}
          </section>
        </>
      )}

      {b.payments.length > 0 && (
        <section className="cd-sec">
          <h3>Payments</h3>
          <table className="cd-table">
            <tbody>
              {b.payments.map((x) => (
                <tr key={x.id} style={x.refunded ? { opacity: 0.5, textDecoration: "line-through" } : undefined}>
                  <td>{x.player ?? "—"}</td>
                  <td>
                    {methodName(x.method)}
                    {x.amount_usd ? ` ($${x.amount_usd} at ₡${x.usd_rate})` : ""}
                  </td>
                  <td>{crc(x.amount)}</td>
                  <td className="muted">{x.taken_by ? `by ${x.taken_by}` : "online"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint">VAT included in what was paid: {crc(b.payments.filter((x) => !x.refunded).reduce((s, x) => s + Number(x.vat_amount), 0))}.</p>
        </section>
      )}

      <section className="cd-sec">
        <h3>Game</h3>
        {b.started_at ? (
          <>
            <p style={{ margin: 0 }}>
              Started at {new Date(b.started_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "America/Costa_Rica" })}.
            </p>
            {b.override_reason && (
              <p className="hint" style={{ color: "var(--danger)" }}>
                Started with an override by {b.override_by ?? "staff"}
                {b.override_at ? ` at ${new Date(b.override_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "America/Costa_Rica" })}` : ""}: {b.override_reason}
              </p>
            )}
          </>
        ) : (
          <StartGame b={b} ready={ready} problems={problems} pending={pending} run={run} />
        )}
      </section>
    </Drawer>
  );
}

type Run = (op: Parameters<typeof courtAction>[0], after?: () => void) => void;

function PlayerCard({ p, b, pending, run }: { p: SPlayer; b: SBooking; pending: boolean; run: Run }) {
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(p.name);
  const [email, setEmail] = useState(p.email ?? "");
  const [phone, setPhone] = useState(p.phone ?? "");
  return (
    <div className="cd-player">
      <header>
        <b>
          {p.name}
          {p.host ? " (booked)" : ""}
        </b>
        <span className={p.owed > 0 ? "cd-owe bad" : "cd-owe"}>{p.owed > 0 ? `${crc(p.owed)} owed` : "Paid"}</span>
      </header>
      <div className="meta">
        {p.phone ?? "no phone"} · {p.email ?? "no email"}
        {!p.named && <b style={{ color: "var(--danger)" }}> · details missing</b>}
        {p.status === "held" && " · paying online"}
      </div>
      <div className="meta">
        Share {crc(p.share)}
        {p.equipment_total > 0 ? ` · equipment ${crc(p.equipment_total)}` : ""} · paid {crc(p.paid)}
      </div>
      {p.equipment.length > 0 && (
        <div className="cd-row">
          {p.equipment.map((e) => (
            <span key={e.id} className="ptype">
              {e.label} {crc(e.price)}
              {!b.started_at && (
                <button type="button" aria-label={`Remove ${e.label}`} className="x" style={{ marginLeft: 4, border: 0, background: "none", cursor: "pointer" }} onClick={() => run({ type: "remove_equipment", id: e.id })}>
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {!b.started_at && (
        <div className="cd-row">
          <button
            type="button"
            className={p.checked_in_at ? "btn sm" : "btn sm primary"}
            disabled={pending || p.status !== "in"}
            onClick={() => run({ type: "check_in", player: p.id, value: !p.checked_in_at })}
          >
            {p.checked_in_at ? "Checked in ✓ (undo)" : "Check in"}
          </button>
          <button type="button" className="btn sm ghost" onClick={() => setEdit((v) => !v)}>
            {edit ? "Close" : p.named ? "Edit details" : "Fill in details"}
          </button>
        </div>
      )}
      {edit && (
        <div className="cd-row">
          <input className="field-in" aria-label="Name" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="field-in" aria-label="Phone" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <input className="field-in" aria-label="Email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button
            type="button"
            className="btn sm primary"
            disabled={pending}
            onClick={() => run({ type: "update_player", player: p.id, name, email, phone }, () => setEdit(false))}
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}

function AddPlayer({ bookingId, pending, run }: { bookingId: string; pending: boolean; run: Run }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  return (
    <div className="cd-row">
      <input className="field-in" aria-label="New player name" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="field-in" aria-label="New player phone" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <input className="field-in" aria-label="New player email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <button
        type="button"
        className="btn sm"
        disabled={pending || !name.trim()}
        onClick={() =>
          run({ type: "add_player", booking: bookingId, name, email, phone }, () => {
            setName("");
            setEmail("");
            setPhone("");
          })
        }
      >
        Add player
      </button>
    </div>
  );
}

function AddEquipment({ b, equipment, pending, run }: { b: SBooking; equipment: Price[]; pending: boolean; run: Run }) {
  const [player, setPlayer] = useState("");
  const [item, setItem] = useState(equipment[0]?.key ?? "");
  const [qty, setQty] = useState(1);
  if (!equipment.length) return <p className="muted">No equipment on the price list.</p>;
  return (
    <div className="cd-row">
      <select className="field-in" aria-label="Who takes it" value={player} onChange={(e) => setPlayer(e.target.value)}>
        <option value="">Who takes it…</option>
        {b.players.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <select className="field-in" aria-label="Equipment" value={item} onChange={(e) => setItem(e.target.value)}>
        {equipment.map((e) => (
          <option key={e.key} value={e.key}>{e.label} · {crc(Number(e.price))}</option>
        ))}
      </select>
      <input className="field-in" aria-label="How many" type="number" min={1} max={10} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} style={{ width: 64 }} />
      <button type="button" className="btn sm" disabled={pending || !player || !item} onClick={() => run({ type: "add_equipment", booking: b.id, player, item, qty })}>
        Add
      </button>
      <span className="hint" style={{ flexBasis: "100%" }}>Whoever takes the equipment pays for it. It isn’t split with the group.</span>
    </div>
  );
}

function TakePayment({ b, usdRate, pending, run }: { b: SBooking; usdRate: number; pending: boolean; run: Run }) {
  const firstOwing = b.players.find((p) => p.owed > 0)?.id ?? b.players[0]?.id ?? "";
  const [player, setPlayer] = useState(firstOwing);
  const [method, setMethod] = useState<string>("card_reader");
  const owedPlayer = Math.max(0, b.players.find((p) => p.id === player)?.owed ?? 0);
  const [amount, setAmount] = useState("");
  const [usd, setUsd] = useState("");
  const isUsd = method === "cash_usd";
  const usdNum = Number(usd);
  const fullUsd = Math.ceil((b.owed / usdRate) * 100) / 100;
  const payAmount = amount === "" ? Math.round(Math.min(owedPlayer || b.owed, b.owed)) : Number(amount);
  return (
    <div className="cd-player">
      <div className="cd-row">
        <select className="field-in" aria-label="Who paid" value={player} onChange={(e) => setPlayer(e.target.value)}>
          {b.players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.owed > 0 ? ` · owes ${crc(p.owed)}` : ""}
            </option>
          ))}
        </select>
        <select className="field-in" aria-label="How they paid" value={method} onChange={(e) => setMethod(e.target.value)}>
          {METHODS.map(([k, l]) => (
            <option key={k} value={k}>{l}</option>
          ))}
        </select>
      </div>
      {isUsd ? (
        <>
          <div className="cd-row">
            <label htmlFor="pay-usd" className="meta">Dollars received</label>
            <input id="pay-usd" className="field-in" type="number" min={0} step="0.01" value={usd} onChange={(e) => setUsd(e.target.value)} style={{ width: 110 }} />
            <button type="button" className="btn sm ghost" onClick={() => setUsd(String(fullUsd))}>
              Whole balance: ${fullUsd.toFixed(2)}
            </button>
          </div>
          <div className="meta">
            Rate ₡{usdRate} per $1.{usdNum > 0 ? ` $${usdNum.toFixed(2)} = ${crc(usdNum * usdRate)}${usdNum * usdRate > b.owed ? ` (only ${crc(b.owed)} is owed)` : ""}.` : ""} Both amounts are recorded.
          </div>
        </>
      ) : (
        <div className="cd-row">
          <label htmlFor="pay-amt" className="meta">Amount (₡)</label>
          <input id="pay-amt" className="field-in" type="number" min={0} step="1" value={amount} placeholder={String(Math.round(Math.min(owedPlayer || b.owed, b.owed)))} onChange={(e) => setAmount(e.target.value)} style={{ width: 130 }} />
          <button type="button" className="btn sm ghost" onClick={() => setAmount(String(Math.round(b.owed)))}>
            Whole balance
          </button>
        </div>
      )}
      <div className="cd-row">
        <button
          type="button"
          className="btn primary"
          disabled={pending || !player || (isUsd ? !(usdNum > 0) : !(payAmount > 0))}
          onClick={() =>
            run(
              { type: "pay", booking: b.id, player, method, amount: isUsd ? null : payAmount, usd: isUsd ? usdNum : null },
              () => {
                setAmount("");
                setUsd("");
              },
            )
          }
        >
          Take payment
        </button>
      </div>
    </div>
  );
}

function StartGame({ b, ready, problems, pending, run }: { b: SBooking; ready: boolean; problems: string[]; pending: boolean; run: Run }) {
  const [override, setOverride] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <div>
      <div className="cd-row">
        <button type="button" className="btn primary" disabled={pending || !ready} onClick={() => run({ type: "start", booking: b.id })}>
          Start game
        </button>
        {!ready && (
          <button type="button" className="btn ghost" onClick={() => setOverride((v) => !v)}>
            Start anyway…
          </button>
        )}
      </div>
      {!ready && (
        <p className="hint">Can’t start yet: {problems.join("; ")}.</p>
      )}
      {override && !ready && (
        <div className="cd-player" style={{ marginTop: 8 }}>
          <label htmlFor="ov-reason" className="meta">Why is it starting anyway? We record your reason, your name and the time.</label>
          <textarea id="ov-reason" className="field-in" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="cd-row">
            <button
              type="button"
              className="btn danger armed"
              disabled={pending || reason.trim().length < 3}
              onClick={() => run({ type: "start", booking: b.id, reason })}
            >
              Override and start
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
