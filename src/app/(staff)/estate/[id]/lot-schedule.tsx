"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ConfirmButton, Drawer, useDrawer } from "@/components/drawer";
import { useToast } from "@/components/toast";
import type { ActionResult } from "@/lib/action-result";
import type { Tables } from "@/lib/database.types";
import { addDays, addMonths, fmtDate, monthLabel } from "@/lib/dates";
import { coversNight, label, MAINT_CATEGORIES, monthGrid, nights, STAY_KINDS } from "@/lib/estate";
import { describeService, FREQS, WEEKDAYS } from "@/lib/services";
import { blockNights, saveService, setHospitality, unblock } from "../actions";

type Lot = Tables<"lots">;
type Stay = Tables<"stays">;
type Task = Tables<"tasks">;
type Service = Tables<"property_services">;

/** One calendar for a property: hospitality (stays and blocks) and maintenance (tasks), plus its services. */
export function LotSchedule({
  lot,
  stays,
  tasks,
  services,
  team,
  today,
}: {
  lot: Lot;
  stays: Stay[];
  tasks: Task[];
  services: Service[];
  team: { id: string; name: string }[];
  today: string;
}) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (p: Promise<ActionResult>) =>
    start(async () => {
      const r = await p;
      toast(r.ok ? (r.message ?? "Saved") : (r.error ?? "Couldn’t save"));
      router.refresh();
    });

  const [month, setMonth] = useState(today.slice(0, 7));
  const [layers, setLayers] = useState({ hospitality: true, maintenance: true });
  const [day, setDay] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const svc = useDrawer<Service>();
  const [freq, setFreq] = useState("weekly");

  const grid = monthGrid(`${month}-01`);
  const live = stays.filter((s) => s.status !== "cancelled");
  const stayAt = (d: string) => live.find((s) => s.status === "confirmed" && coversNight(s, d));
  const inquiryAt = (d: string) => live.find((s) => s.status === "inquiry" && coversNight(s, d));
  const tasksOn = (d: string) => tasks.filter((t) => t.due_date === d);

  const state = !lot.in_hospitality ? "off" : lot.listing_published ? "live" : "waiting";
  const upcomingBlocks = live.filter((s) => s.kind === "hold" && s.check_out >= today);
  const s = svc.item;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section className="panel">
        <h2>
          {monthLabel(month)}
          <span className="weeknav" style={{ margin: 0 }}>
            <button type="button" className="btn sm" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month">←</button>
            <button type="button" className="btn sm" onClick={() => setMonth(today.slice(0, 7))}>Today</button>
            <button type="button" className="btn sm" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month">→</button>
          </span>
        </h2>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", margin: "0 0 10px" }}>
          {(["hospitality", "maintenance"] as const).map((k) => (
            <label key={k} className="check">
              <input type="checkbox" checked={layers[k]} onChange={(e) => setLayers({ ...layers, [k]: e.target.checked })} />
              {k === "hospitality" ? "Hospitality" : "Maintenance"}
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
            const work = layers.maintenance ? tasksOn(d) : [];
            return (
              <button
                key={d}
                type="button"
                className={[
                  "avcal-d",
                  d.slice(0, 7) !== month ? "out" : "",
                  d === today ? "today" : "",
                  st ? `taken ${st.kind}` : "",
                  inq ? "inq" : "",
                  day === d ? "chosen" : "",
                ].join(" ")}
                style={{ position: "relative", cursor: "pointer" }}
                onClick={() => setDay(day === d ? null : d)}
              >
                {Number(d.slice(8))}
                {work.length > 0 && (
                  <i
                    aria-hidden="true"
                    style={{ position: "absolute", bottom: 3, left: "50%", width: 6, height: 6, marginLeft: -3, borderRadius: 99, background: work.some((t) => t.status !== "done") ? "var(--sun)" : "var(--leaf)" }}
                  />
                )}
              </button>
            );
          })}
        </div>
        <div className="tl-legend" style={{ marginTop: 8 }}>
          {layers.hospitality && (
            <>
              <span><i className="guest" /> Guest</span>
              <span><i className="owner" /> Owner</span>
              <span><i className="hold" /> Blocked</span>
              <span><i className="inquiry" /> Inquiry</span>
            </>
          )}
          {layers.maintenance && <span><i style={{ background: "var(--sun)" }} /> Work due</span>}
        </div>
        {day && (
          <div className="avsel" style={{ display: "block", marginTop: 10 }}>
            <b>{fmtDate(day, { weekday: "long", month: "long", day: "numeric" })}</b>
            {layers.hospitality &&
              live.filter((x) => coversNight(x, day)).map((x) => (
                <div key={x.id} style={{ fontSize: 14 }}>
                  {x.kind === "guest" ? x.guest_name : label(STAY_KINDS, x.kind)} · {fmtDate(x.check_in)} – {fmtDate(x.check_out)}
                  {x.status === "inquiry" ? " · inquiry" : ""}
                </div>
              ))}
            {layers.maintenance &&
              tasksOn(day).map((t) => (
                <div key={t.id} style={{ fontSize: 14 }}>
                  {t.title} · {t.status === "done" ? "done" : "to do"}
                  {t.service_id ? " · recurring" : ""}
                </div>
              ))}
            {!(layers.hospitality && live.some((x) => coversNight(x, day))) && !(layers.maintenance && tasksOn(day).length) && (
              <div className="muted" style={{ fontSize: 14 }}>Nothing on this day.</div>
            )}
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Hospitality</h2>
        <p style={{ margin: "0 0 10px" }}>
          <span className={`tag-sm ${state === "live" ? "" : state === "waiting" ? "low" : "out"}`}>
            {state === "live" ? "Live" : state === "waiting" ? "On, not published" : "Off"}
          </span>{" "}
          <span className="muted" style={{ fontSize: 13.5 }}>
            {state === "live"
              ? "Guests can book this home on the website, outside the blocked dates."
              : state === "waiting"
                ? "In the programme, but not on the website yet. Publish it from Hospitality once it has a rate and photos."
                : "Not in the hospitality programme, so no guest can book it."}
          </span>
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          <button type="button" className="btn sm" disabled={pending} onClick={() => run(setHospitality(lot.id, !lot.in_hospitality))}>
            {lot.in_hospitality ? "Turn hospitality off" : "Turn hospitality on"}
          </button>
          {lot.in_hospitality && (
            <a className="btn ghost sm" href={`/hospitality/${lot.id}`}>Listing and publishing</a>
          )}
        </div>
        {lot.in_hospitality && (
          <>
            <h3 className="avh">Make dates unavailable</h3>
            <form
              className="avail-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!from || !to) return toast("Choose the first and last night.");
                run(blockNights(lot.id, from, addDays(to, 1), note.trim() || "Unavailable"));
                setFrom("");
                setTo("");
                setNote("");
              }}
            >
              <label><span className="lbl">First night</span><input type="date" value={from} min={today} onChange={(e) => setFrom(e.target.value)} /></label>
              <label><span className="lbl">Last night</span><input type="date" value={to} min={from || today} onChange={(e) => setTo(e.target.value)} /></label>
              <label><span className="lbl">Note</span><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" /></label>
              <button type="submit" className="btn primary sm" disabled={pending}>Block</button>
            </form>
            <p className="muted" style={{ fontSize: 13, margin: "8px 0 0" }}>
              Everything else stays open. Blocked nights are also closed on Guesty at the next sync.
            </p>
            {upcomingBlocks.length > 0 && (
              <div style={{ marginTop: 10 }}>
                {upcomingBlocks.map((b) => (
                  <div key={b.id} className="stay-line static">
                    <span className="d">{fmtDate(b.check_in)}</span>
                    <span>
                      <b>{b.guest_name}</b>
                      <span className="muted"> · {nights(b.check_in, b.check_out)} night{nights(b.check_in, b.check_out) === 1 ? "" : "s"}</span>
                    </span>
                    <button type="button" className="btn ghost sm" disabled={pending} onClick={() => run(unblock(lot.id, b.id))}>Open up</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <section className="panel">
        <h2>
          Recurring services
          <button type="button" className="btn primary sm" onClick={() => { setFreq("weekly"); svc.openNew(); }}>Add a service</button>
        </h2>
        {services.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            None yet. A weekly clean or a monthly garden visit set up here becomes tasks on the Operations board, and shows in the maintenance log.
          </p>
        ) : (
          services.map((x) => (
            <div key={x.id} className="stay-line static">
              <span className="d">{x.active ? "On" : "Paused"}</span>
              <button type="button" className="linkish-inline" onClick={() => { setFreq(x.freq); svc.openItem(x); }}>
                <b>{x.title}</b>
                <span className="muted"> · {describeService(x)} · {label(MAINT_CATEGORIES, x.maint_category)}</span>
              </button>
              <span className="muted" style={{ fontSize: 13 }}>{team.find((m) => m.id === x.assignee_id)?.name ?? ""}</span>
            </div>
          ))
        )}
      </section>

      <Drawer
        key={s?.id ?? "new-service"}
        title={s ? "Edit service" : "Add a service"}
        open={svc.open}
        onClose={svc.close}
        action={saveService}
        footer={
          <>
            {s && <ConfirmButton />}
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={svc.close}>Cancel</button>
            <button type="submit" className="btn primary">Save</button>
          </>
        }
      >
        <input type="hidden" name="lot_id" value={lot.id} />
        {s && <input type="hidden" name="id" value={s.id} />}
        <div className="fld">
          <label htmlFor="sv-title">Service</label>
          <input id="sv-title" name="title" required defaultValue={s?.title ?? ""} placeholder="e.g. Weekly cleaning" />
        </div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="sv-cat">Type</label>
            <select id="sv-cat" name="maint_category" defaultValue={s?.maint_category ?? "cleaning"}>
              {MAINT_CATEGORIES.map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label htmlFor="sv-freq">How often</label>
            <select id="sv-freq" name="freq" value={freq} onChange={(e) => setFreq(e.target.value)}>
              {FREQS.map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </select>
          </div>
        </div>
        {freq !== "once" && (
          <div className="grid2">
            <div className="fld">
              <label htmlFor="sv-every">Every</label>
              <input id="sv-every" name="every" type="number" min={1} max={52} defaultValue={s?.every ?? 1} />
              <span className="muted" style={{ fontSize: 12.5 }}>
                {freq === "weekly" ? "weeks" : freq === "monthly" ? "months" : "years"}
              </span>
            </div>
            {freq === "weekly" && (
              <div className="fld">
                <label htmlFor="sv-wd">On</label>
                <select id="sv-wd" name="weekday" defaultValue={s?.weekday ?? 0}>
                  {WEEKDAYS.map((d, i) => (
                    <option key={d} value={i}>{d}</option>
                  ))}
                </select>
              </div>
            )}
            {freq === "monthly" && (
              <div className="fld">
                <label htmlFor="sv-md">Day of the month</label>
                <input id="sv-md" name="month_day" type="number" min={1} max={31} defaultValue={s?.month_day ?? 1} />
              </div>
            )}
          </div>
        )}
        <div className="grid2">
          <div className="fld">
            <label htmlFor="sv-start">{freq === "once" ? "Date" : "Starting"}</label>
            <input id="sv-start" name="start_date" type="date" required defaultValue={s?.start_date ?? today} />
          </div>
          {freq !== "once" && (
            <div className="fld">
              <label htmlFor="sv-end">Until (optional)</label>
              <input id="sv-end" name="end_date" type="date" defaultValue={s?.end_date ?? ""} />
            </div>
          )}
        </div>
        <div className="fld">
          <label htmlFor="sv-asg">Assigned to</label>
          <select id="sv-asg" name="assignee_id" defaultValue={s?.assignee_id ?? ""}>
            <option value="">Unassigned</option>
            {team.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div className="fld">
          <label htmlFor="sv-notes">Instructions</label>
          <textarea id="sv-notes" name="notes" rows={3} defaultValue={s?.notes ?? ""} />
        </div>
        <label className="check" style={{ marginBottom: 8 }}>
          <input type="checkbox" name="owner_visible" defaultChecked={s?.owner_visible ?? true} />
          Show to the owner on My Property
        </label>
        <label className="check">
          <input type="checkbox" name="active" defaultChecked={s?.active ?? true} />
          Active (untick to pause; upcoming tasks that haven’t started are removed)
        </label>
      </Drawer>
    </div>
  );
}
