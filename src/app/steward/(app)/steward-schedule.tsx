"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import type { Database } from "@/lib/database.types";
import { addMonths, fmtDate, monthLabel } from "@/lib/dates";
import { coversNight, label, MAINT_CATEGORIES, monthGrid, nights } from "@/lib/estate";
import { describeService } from "@/lib/services";
import { blockMyDates, cancelMyDates, setMyHospitality } from "./actions";
import { Fld, Form } from "./property-view";

type Fn = Database["public"]["Functions"];
type Lot = Fn["my_properties"]["Returns"][number];
type Stay = Fn["my_property_stays"]["Returns"][number];
type Work = Fn["my_property_work"]["Returns"][number];
type Service = Fn["my_property_services"]["Returns"][number];

/** The steward's calendar: manage hospitality (on/off, dates they're away or want closed); the maintenance schedule is view only. */
export function StewardSchedule({
  lot,
  stays,
  work,
  services,
  today,
}: {
  lot: Lot;
  stays: Stay[];
  work: Work[];
  services: Service[];
  today: string;
}) {
  const toast = useToast();
  const [busy, start] = useTransition();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [layers, setLayers] = useState({ hospitality: true, maintenance: true });
  const [day, setDay] = useState<string | null>(null);
  const muted = { color: "var(--pv-muted)" };

  const live = stays.filter((s) => s.status !== "cancelled");
  const grid = monthGrid(`${month}-01`);
  const stayAt = (d: string) => live.find((s) => s.status === "confirmed" && coversNight(s, d));
  const inquiryAt = (d: string) => live.find((s) => s.status === "inquiry" && coversNight(s, d));
  const workOn = (d: string) => work.filter((w) => w.on_date === d);
  const state = !lot.in_hospitality ? "off" : lot.listing_published ? "live" : "waiting";
  const act = (p: Promise<{ ok: boolean; message?: string; error?: string }>) =>
    start(async () => {
      const r = await p;
      toast(r.ok ? (r.message ?? "Saved") : (r.error ?? "Couldn’t save"));
    });

  return (
    <div className="pv-two">
      <div style={{ display: "grid", gap: 20 }}>
        <section className="pv-panel">
          <h2 style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            {monthLabel(month)}
            <span style={{ display: "flex", gap: 6 }}>
              <button type="button" className="pv-btn ghost sm" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month">←</button>
              <button type="button" className="pv-btn ghost sm" onClick={() => setMonth(today.slice(0, 7))}>Today</button>
              <button type="button" className="pv-btn ghost sm" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month">→</button>
            </span>
          </h2>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", margin: "0 0 10px" }}>
            {(["hospitality", "maintenance"] as const).map((k) => (
              <label key={k} className="pv-switch" style={{ alignItems: "center" }}>
                <input type="checkbox" checked={layers[k]} onChange={(e) => setLayers({ ...layers, [k]: e.target.checked })} />
                <span>{k === "hospitality" ? "Hospitality" : "Maintenance"}</span>
              </label>
            ))}
          </div>
          <div className="avcal">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <span key={i} className="avcal-dow">{d}</span>
            ))}
            {grid.days.map((d) => {
              const st = layers.hospitality ? stayAt(d) : undefined;
              const inq = layers.hospitality && !st ? inquiryAt(d) : undefined;
              const w = layers.maintenance ? workOn(d) : [];
              return (
                <button
                  key={d}
                  type="button"
                  className={["avcal-d", d.slice(0, 7) !== month ? "out" : "", d === today ? "today" : "", st ? `taken ${st.kind}` : "", inq ? "inq" : "", day === d ? "chosen" : ""].join(" ")}
                  style={{ position: "relative", cursor: "pointer" }}
                  onClick={() => setDay(day === d ? null : d)}
                >
                  {Number(d.slice(8))}
                  {w.length > 0 && (
                    <i aria-hidden="true" style={{ position: "absolute", bottom: 3, left: "50%", width: 6, height: 6, marginLeft: -3, borderRadius: 99, background: w.some((x) => x.status !== "done") ? "var(--sun)" : "var(--leaf)" }} />
                  )}
                </button>
              );
            })}
          </div>
          <div className="tl-legend" style={{ marginTop: 8 }}>
            {layers.hospitality && (
              <>
                <span><i className="guest" /> Guest</span>
                <span><i className="owner" /> You</span>
                <span><i className="hold" /> Blocked</span>
              </>
            )}
            {layers.maintenance && <span><i style={{ background: "var(--sun)" }} /> Work scheduled</span>}
          </div>
          {day && (
            <div style={{ marginTop: 10, fontSize: 14.5 }}>
              <b>{fmtDate(day, { weekday: "long", month: "long", day: "numeric" })}</b>
              {layers.hospitality && live.filter((x) => coversNight(x, day)).map((x) => (
                <div key={x.id}>{x.label} · {fmtDate(x.check_in)} – {fmtDate(x.check_out)}{x.status === "inquiry" ? " · inquiry" : ""}</div>
              ))}
              {layers.maintenance && workOn(day).map((w) => (
                <div key={w.id}>{w.title} · {w.status === "done" ? "done" : w.status === "in_progress" ? "in progress" : "scheduled"}</div>
              ))}
              {!(layers.hospitality && live.some((x) => coversNight(x, day))) && !(layers.maintenance && workOn(day).length) && (
                <div style={muted}>Nothing on this day.</div>
              )}
            </div>
          )}
        </section>

        <section className="pv-panel">
          <h2>Maintenance schedule</h2>
          <p style={{ ...muted, marginTop: 0, fontSize: 14 }}>Set up by the team. You can see it here but not change it. Use “Ask the team for work” on the Overview for anything new.</p>
          {services.length === 0 ? (
            <p style={{ ...muted, margin: 0 }}>No recurring services yet.</p>
          ) : (
            services.map((s) => (
              <div key={s.id} className="pv-post">
                <b>{s.title}</b>
                <div style={{ ...muted, fontSize: 13.5 }}>{describeService(s)} · {label(MAINT_CATEGORIES, s.maint_category)}</div>
              </div>
            ))
          )}
        </section>
      </div>

      <aside style={{ display: "grid", gap: 20 }}>
        <section className="pv-panel">
          <h2>Hospitality</h2>
          <p style={{ margin: "0 0 10px" }}>
            <b>{state === "live" ? "Live" : state === "waiting" ? "On, not published yet" : "Off"}</b>
            <span style={{ ...muted, display: "block", fontSize: 14 }}>
              {state === "live"
                ? "Guests can book your home on the website, outside the dates you’ve blocked."
                : state === "waiting"
                  ? "You’re in the programme. The team publishes the listing once it has a rate and photos."
                  : "Your home isn’t offered to guests."}
            </span>
          </p>
          <button type="button" className="pv-btn sm" disabled={busy} onClick={() => act(setMyHospitality(lot.id, !lot.in_hospitality))}>
            {lot.in_hospitality ? "Turn hospitality off" : "Turn hospitality on"}
          </button>
        </section>

        {lot.in_hospitality && (
          <section className="pv-panel">
            <h2>Dates you’re away or using the home</h2>
            <p style={{ ...muted, marginTop: 0, fontSize: 14 }}>Guests can’t book these dates. Everything else stays open.</p>
            {stays.filter((s) => s.kind === "owner").map((s) => (
              <div key={s.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "6px 0" }}>
                <span>
                  {fmtDate(s.check_in)} – {fmtDate(s.check_out)}
                  <span style={{ ...muted, display: "block", fontSize: 13.5 }}>{nights(s.check_in, s.check_out)} nights</span>
                </span>
                <button type="button" className="pv-btn ghost sm" disabled={busy} onClick={() => act(cancelMyDates(s.id))}>Release</button>
              </div>
            ))}
            <details style={{ marginTop: 8 }} open={stays.every((s) => s.kind !== "owner")}>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>Block dates</summary>
              <Form action={blockMyDates} submit="Block these dates" reset>
                <input type="hidden" name="lot_id" value={lot.id} />
                <Fld id="sb-from" text="From (first night)">
                  <input id="sb-from" name="from" type="date" className="pv-input" min={today} required />
                </Fld>
                <Fld id="sb-to" text="Until (the day you’re back)">
                  <input id="sb-to" name="to" type="date" className="pv-input" min={today} required />
                </Fld>
                <Fld id="sb-note" text="Note for the team">
                  <input id="sb-note" name="note" className="pv-input" placeholder="Optional" />
                </Fld>
              </Form>
            </details>
          </section>
        )}
      </aside>
    </div>
  );
}
