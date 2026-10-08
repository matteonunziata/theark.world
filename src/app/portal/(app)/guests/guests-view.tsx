"use client";

import Link from "next/link";
import { useActionState, useEffect, useEffectEvent, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useToast } from "@/components/toast";
import type { ActionResult } from "@/lib/action-result";
import { fmtDate, monthLabel } from "@/lib/dates";
import { cancelGuest, inviteGuest } from "../../actions";

export type Guest = {
  id: string;
  guest_name: string;
  phone: string | null;
  email: string | null;
  visit_date: string;
  token: string;
  status: string;
  used_at: string | null;
};

type Allowance = { allowed: number; used: number };

export function GuestsView({
  thisMonth,
  nextMonth,
  guests,
  today,
  maxDate,
  origin,
  orgName,
  hostFirst,
}: {
  thisMonth: Allowance;
  nextMonth: Allowance;
  guests: Guest[];
  today: string;
  maxDate: string;
  origin: string;
  orgName: string;
  hostFirst: string;
}) {
  const toast = useToast();
  const form = useRef<HTMLFormElement>(null);
  const [last, setLast] = useState<Guest | null>(null);
  const [state, action, pending] = useActionState(inviteGuest, { ok: false } as ActionResult & { token?: string });
  const [busy, start] = useTransition();
  const draft = useRef<{ guest_name: string; phone: string | null; email: string | null; visit_date: string } | null>(null);

  const onResult = useEffectEvent((r: ActionResult & { token?: string }) => {
    if (r.ok && r.token && draft.current) {
      toast(r.message ?? "Invited");
      setLast({ id: r.token, ...draft.current, token: r.token, status: "invited", used_at: null });
      form.current?.reset();
    } else if (r.error) {
      toast(r.error);
    }
  });
  useEffect(() => onResult(state), [state]);

  // Chrome on Android can open the phone's contacts; other browsers don't offer it.
  const canPick = useSyncExternalStore(
    () => () => {},
    () => "contacts" in navigator && "ContactsManager" in window,
    () => false,
  );
  const pick = async () => {
    try {
      type Picker = { select: (p: string[], o: { multiple: boolean }) => Promise<{ name?: string[]; tel?: string[]; email?: string[] }[]> };
      const [c] = await (navigator as unknown as { contacts: Picker }).contacts.select(["name", "tel", "email"], { multiple: false });
      const f = form.current;
      if (!c || !f) return;
      const set = (n: string, v?: string) => v && ((f.elements.namedItem(n) as HTMLInputElement).value = v);
      set("guest_name", c.name?.[0]);
      set("phone", c.tel?.[0]);
      set("email", c.email?.[0]);
    } catch {
      /* closed without choosing */
    }
  };

  const none = thisMonth.allowed === 0 && nextMonth.allowed === 0;
  const thisKey = today.slice(0, 7);
  const upcoming = guests.filter((g) => g.visit_date >= today && g.status !== "cancelled");
  const past = guests.filter((g) => g.visit_date < today || g.status === "cancelled");

  return (
    <>
      <div className="pv-sec-h" style={{ marginBottom: 18 }}>
        <div>
          <h1 className="pv-h1">Guests</h1>
          <p>Bring a friend for the day. They get their own pass to show security.</p>
        </div>
      </div>

      {none ? (
        <div className="pv-empty">
          <h3>Your membership doesn’t include guest passes</h3>
          <p>Monthly, 3-month and 6-month memberships come with 4 guest passes a month, and annual memberships with 8. Day and week passes don’t include guests.</p>
        </div>
      ) : (
        <>
          <div className="gp-meters">
            {[
              [thisKey, thisMonth],
              [nextKeyOf(thisKey), nextMonth],
            ].map(([k, a]) => {
              const al = a as Allowance;
              const left = Math.max(0, al.allowed - al.used);
              return (
                <div key={k as string} className="pv-panel gp-meter">
                  <span className="gp-month">{monthLabel(k as string)}</span>
                  <b>{left}</b>
                  <span>of {al.allowed} guest passes left</span>
                  <div className="gp-dots" aria-hidden="true">
                    {Array.from({ length: al.allowed }, (_, i) => (
                      <i key={i} className={i < al.used ? "used" : ""} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <section className="pv-panel" style={{ marginTop: 18 }}>
            <h2 style={{ marginTop: 0 }}>Invite a guest</h2>
            <form
              ref={form}
              action={(fd) => {
                draft.current = {
                  guest_name: String(fd.get("guest_name") ?? ""),
                  phone: (fd.get("phone") as string) || null,
                  email: (fd.get("email") as string) || null,
                  visit_date: String(fd.get("visit_date") ?? ""),
                };
                action(fd);
              }}
              className="gp-form"
            >
              {canPick && (
                <button type="button" className="pv-btn ghost" onClick={pick}>
                  Choose from contacts
                </button>
              )}
              <label>
                <span>Name</span>
                <input name="guest_name" required autoComplete="off" placeholder="Their full name" />
              </label>
              <label>
                <span>Phone or WhatsApp</span>
                <input name="phone" type="tel" placeholder="+506 …" />
              </label>
              <label>
                <span>Email</span>
                <input name="email" type="email" placeholder="We’ll send them the pass" />
              </label>
              <label>
                <span>Day of the visit</span>
                <input name="visit_date" type="date" required min={today} max={maxDate} defaultValue={today} />
              </label>
              <button type="submit" className="pv-btn" disabled={pending}>
                {pending ? "Sending…" : "Invite and send pass"}
              </button>
            </form>
            <p className="gp-note">We send the pass to their WhatsApp and email as soon as you invite them. Each pass works once, on the day you choose.</p>
          </section>

          {last && <ShareCard g={last} origin={origin} orgName={orgName} hostFirst={hostFirst} onClose={() => setLast(null)} />}
        </>
      )}

      {upcoming.length > 0 && (
        <section className="pv-sec">
          <h2>Coming up</h2>
          <div className="gp-list">
            {upcoming.map((g) => (
              <div key={g.id} className="pv-panel gp-row">
                <div>
                  <b>{g.guest_name}</b>
                  <span>
                    {g.visit_date === today ? "Today" : fmtDate(g.visit_date, { weekday: "long", month: "long", day: "numeric" })}
                    {g.status === "used" ? " · arrived" : ""}
                  </span>
                </div>
                <div className="gp-acts">
                  <button type="button" className="pv-btn ghost sm" onClick={() => setLast(g)}>Send pass</button>
                  {g.status === "invited" && (
                    <button
                      type="button"
                      className="pv-btn ghost sm"
                      disabled={busy}
                      onClick={() =>
                        confirm(`Cancel ${g.guest_name}’s invite?`) &&
                        start(async () => {
                          const r = await cancelGuest(g.id);
                          toast(r.ok ? (r.message ?? "") : (r.error ?? ""));
                        })
                      }
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section className="pv-sec">
          <h2>Earlier</h2>
          <div className="gp-list">
            {past.map((g) => (
              <div key={g.id} className="pv-panel gp-row past">
                <div>
                  <b>{g.guest_name}</b>
                  <span>
                    {fmtDate(g.visit_date, { month: "short", day: "numeric" })} ·{" "}
                    {g.status === "used" ? "came" : g.status === "cancelled" ? "cancelled" : "didn’t come"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="gp-note" style={{ textAlign: "center", marginTop: 24 }}>
        <Link href="/portal/pass">Your own pass</Link>
      </p>
    </>
  );
}

const nextKeyOf = (k: string) => {
  const [y, m] = k.split("-").map(Number);
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
};

function ShareCard({
  g,
  origin,
  orgName,
  hostFirst,
  onClose,
}: {
  g: Guest;
  origin: string;
  orgName: string;
  hostFirst: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const url = `${origin}/g/${g.token}`;
  const day = fmtDate(g.visit_date, { weekday: "long", month: "long", day: "numeric" });
  const text = `Hi ${g.guest_name.split(/\s+/)[0]}, you’re my guest at ${orgName} on ${day}. Here’s your pass to show security when you arrive: ${url}${hostFirst ? `\n\n${hostFirst}` : ""}`;
  const phone = (g.phone ?? "").replace(/\D/g, "");
  const wa = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  const mail = `mailto:${g.email ?? ""}?subject=${encodeURIComponent(`Your guest pass for ${orgName}`)}&body=${encodeURIComponent(text)}`;
  return (
    <section className="pv-panel gp-share" aria-live="polite">
      <div className="gp-share-h">
        <h2>Send {g.guest_name.split(/\s+/)[0]} their pass</h2>
        <button type="button" className="pv-btn ghost sm" onClick={onClose}>Done</button>
      </div>
      <p>{day}. The pass works once, on that day.</p>
      <div className="gp-acts">
        <a className="pv-btn" href={wa} target="_blank" rel="noreferrer">WhatsApp</a>
        <a className="pv-btn ghost" href={mail}>Email</a>
        <button
          type="button"
          className="pv-btn ghost"
          onClick={() =>
            navigator.clipboard.writeText(url).then(
              () => toast("Link copied"),
              () => toast("Copy the link from the pass page"),
            )
          }
        >
          Copy link
        </button>
        <a className="pv-btn ghost" href={url} target="_blank" rel="noreferrer">See the pass</a>
      </div>
    </section>
  );
}
