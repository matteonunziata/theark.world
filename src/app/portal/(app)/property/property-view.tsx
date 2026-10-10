"use client";

import { type ReactNode, useActionState, useEffect, useTransition } from "react";
import { useToast } from "@/components/toast";
import type { ActionResult } from "@/lib/action-result";
import type { Database, Tables } from "@/lib/database.types";
import { fmtDate } from "@/lib/dates";
import {
  area,
  estatePhoto,
  HOME_STATUS,
  label,
  lotTitle,
  MAINT_CATEGORIES,
  MAINT_STATUS,
  nights,
  RELATIONS,
} from "@/lib/estate";
import { money } from "@/lib/schedule";
import { blockMyDates, cancelMyDates, requestWork, saveMyHousehold, saveMyNotes } from "./actions";

type Prop = Database["public"]["Functions"]["my_properties"]["Returns"][number];

type Stay = {
  id: string;
  kind: string;
  status: string;
  label: string;
  guests: number | null;
  check_in: string;
  check_out: string;
};

/** A form that runs a server action and reports the result in a toast. */
function Form({
  action,
  children,
  submit,
  reset,
}: {
  action: (prev: ActionResult, data: FormData) => Promise<ActionResult>;
  children: ReactNode;
  submit: string;
  /** Clear the fields after a successful save (for "add" forms). */
  reset?: boolean;
}) {
  const toast = useToast();
  const [state, run, pending] = useActionState(action, { ok: false } as ActionResult);
  useEffect(() => {
    if (state.ok && state.message) toast(state.message);
    if (!state.ok && state.error) toast(state.error);
  }, [state, toast]);
  return (
    <form className="pv-form" action={run} key={reset && state.ok ? state.message : "f"}>
      {children}
      <div>
        <button type="submit" className="pv-btn sm" disabled={pending}>
          {pending ? "Saving…" : submit}
        </button>
      </div>
    </form>
  );
}

const Fld = ({ id, text, children }: { id: string; text: string; children: ReactNode }) => (
  <div>
    <label htmlFor={id}>{text}</label>
    {children}
  </div>
);

export function PropertyView({
  lot,
  household,
  logs,
  stays,
  today,
}: {
  lot: Prop;
  household: Tables<"lot_household">[];
  logs: Tables<"lot_maintenance">[];
  stays: Stay[];
  today: string;
}) {
  const toast = useToast();
  const [busy, start] = useTransition();
  const photo = estatePhoto(lot.photo_path);
  const aerial = estatePhoto(lot.aerial_path);
  const open = logs.filter((l) => l.status !== "done");
  const done = logs.filter((l) => l.status === "done");
  const homeLine = [
    lot.bedrooms !== null ? `${lot.bedrooms} bed` : null,
    lot.bathrooms !== null ? `${Number(lot.bathrooms)} bath` : null,
    area(lot.built_m2) ? `${area(lot.built_m2)} built` : null,
  ].filter(Boolean);
  const muted = { color: "var(--pv-muted)" };
  const summary = { cursor: "pointer", fontWeight: 600 } as const;

  return (
    <>
      <div className="pv-sec-h" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="pv-h1">{lotTitle(lot)}</h1>
          <p>
            {[lot.name ? `Lot ${lot.code}` : null, lot.zone, area(lot.size_m2)].filter(Boolean).join(" · ") ||
              "Your property at The ARK"}
          </p>
        </div>
      </div>

      {(photo || aerial) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginBottom: 20 }}>
          {[photo, aerial].filter(Boolean).map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src as string} alt={lotTitle(lot)} style={{ width: "100%", height: 220, objectFit: "cover", borderRadius: 18 }} />
          ))}
        </div>
      )}

      <div className="pv-two">
        <div style={{ display: "grid", gap: 20 }}>
          <section className="pv-panel">
            <h2>Your lot</h2>
            <dl className="pv-kv" style={{ margin: 0 }}>
              <dt>Lot</dt>
              <dd>{lot.code}</dd>
              {lot.zone && (
                <>
                  <dt>Zone</dt>
                  <dd>{lot.zone}</dd>
                </>
              )}
              <dt>Size</dt>
              <dd>{area(lot.size_m2) ?? "—"}</dd>
              {lot.features && (
                <>
                  <dt>Specifications</dt>
                  <dd>{lot.features}</dd>
                </>
              )}
              <dt>Home</dt>
              <dd>
                {lot.home_status === "none"
                  ? "No home yet"
                  : [lot.home_name, label(HOME_STATUS, lot.home_status), ...homeLine].filter(Boolean).join(" · ")}
              </dd>
            </dl>
            {lot.description && <p style={{ whiteSpace: "pre-line", margin: "14px 0 0" }}>{lot.description}</p>}
            {lot.home_notes && <p style={{ whiteSpace: "pre-line", margin: "10px 0 0" }}>{lot.home_notes}</p>}
          </section>

          <section className="pv-panel">
            <h2>Maintenance</h2>
            {logs.length === 0 ? (
              <p style={{ ...muted, marginTop: 0 }}>
                Nothing logged yet. Repairs, garden, pool and cleaning work the team does will show here.
              </p>
            ) : (
              <div>
                {[...open, ...done].map((l) => (
                  <div key={l.id} className="pv-post">
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <b>{l.title}</b>
                      <span style={{ ...muted, fontSize: 13.5, whiteSpace: "nowrap" }}>
                        {l.status !== "done"
                          ? label(MAINT_STATUS, l.status)
                          : fmtDate(l.performed_on, { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </div>
                    <div style={{ ...muted, fontSize: 13.5 }}>
                      {label(MAINT_CATEGORIES, l.category)}
                      {l.done_by ? ` · ${l.done_by}` : ""}
                      {l.cost !== null ? ` · ${money(l.cost, l.currency)}` : ""}
                    </div>
                    {l.details && <div style={{ fontSize: 14.5, marginTop: 4 }}>{l.details}</div>}
                  </div>
                ))}
              </div>
            )}
            <details style={{ marginTop: 14 }}>
              <summary style={summary}>Ask the team for work</summary>
              <Form action={requestWork} submit="Send request" reset>
                <input type="hidden" name="lot_id" value={lot.id} />
                <Fld id="rq-title" text="What do you need?">
                  <input id="rq-title" name="title" className="pv-input" required placeholder="e.g. Pool pump is making noise" />
                </Fld>
                <Fld id="rq-cat" text="Type">
                  <select id="rq-cat" name="category" className="pv-input" defaultValue="repair">
                    {MAINT_CATEGORIES.filter(([k]) => k !== "build").map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Fld>
                <Fld id="rq-det" text="Details">
                  <textarea id="rq-det" name="details" className="pv-input" rows={3} />
                </Fld>
              </Form>
            </details>
          </section>
        </div>

        <aside style={{ display: "grid", gap: 20 }}>
          <section className="pv-panel">
            <h2>Household</h2>
            {household.length === 0 && (
              <p style={{ ...muted, marginTop: 0 }}>
                No one listed yet. Add the family who live here, so the team knows who to expect.
              </p>
            )}
            {household.map((m) => (
              <details key={m.id} className="pv-post">
                <summary style={{ cursor: "pointer" }}>
                  <b>{m.name}</b>
                  <span style={muted}>
                    {" "}
                    · {label(RELATIONS, m.relation)}
                    {m.lives_on_site ? "" : " · not on site"}
                  </span>
                </summary>
                <MemberForm lotId={lot.id} m={m} />
              </details>
            ))}
            <details style={{ marginTop: 10 }}>
              <summary style={summary}>Add a person</summary>
              <MemberForm lotId={lot.id} first={household.length === 0} />
            </details>
          </section>

          <section className="pv-panel">
            <h2>Hospitality</h2>
            {lot.in_hospitality ? (
              <>
                <p style={{ marginTop: 0 }}>
                  In the active stewardship programme
                  {lot.hospitality_since
                    ? ` since ${fmtDate(lot.hospitality_since, { month: "long", year: "numeric" })}`
                    : ""}
                  .{lot.listing_published ? " Your home is listed for guests." : " Your home isn’t listed for guests yet."}
                </p>
                <p style={{ ...muted, margin: "0 0 12px", fontSize: 14 }}>
                  {[
                    lot.nightly_rate !== null ? `${money(lot.nightly_rate, lot.rate_currency)} a night` : null,
                    lot.max_guests ? `up to ${lot.max_guests} guests` : null,
                    lot.min_nights > 1 ? `${lot.min_nights}-night minimum` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <h3 style={{ fontSize: 16, margin: "0 0 6px" }}>Upcoming</h3>
                {stays.length === 0 ? (
                  <p style={{ ...muted, marginTop: 0 }}>No upcoming stays or blocked dates.</p>
                ) : (
                  stays.map((s) => (
                    <div key={s.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "6px 0" }}>
                      <span>
                        <b>{s.label}</b>
                        {s.status === "inquiry" && <span style={muted}> · inquiry</span>}
                        <span style={{ display: "block", ...muted, fontSize: 13.5 }}>
                          {fmtDate(s.check_in)} – {fmtDate(s.check_out)} · {nights(s.check_in, s.check_out)} nights
                          {s.check_in <= today ? " · here now" : ""}
                        </span>
                      </span>
                      {s.kind === "owner" && (
                        <button
                          type="button"
                          className="pv-btn ghost sm"
                          disabled={busy}
                          onClick={() =>
                            start(async () => {
                              const r = await cancelMyDates(s.id);
                              toast(r.ok ? (r.message ?? "Done") : (r.error ?? "Couldn’t save"));
                            })
                          }
                        >
                          Release
                        </button>
                      )}
                    </div>
                  ))
                )}
                <details style={{ marginTop: 12 }}>
                  <summary style={summary}>I’m using the home</summary>
                  <Form action={blockMyDates} submit="Block these dates" reset>
                    <input type="hidden" name="lot_id" value={lot.id} />
                    <Fld id="bd-from" text="Arriving">
                      <input id="bd-from" name="from" type="date" className="pv-input" min={today} required />
                    </Fld>
                    <Fld id="bd-to" text="Leaving">
                      <input id="bd-to" name="to" type="date" className="pv-input" min={today} required />
                    </Fld>
                    <Fld id="bd-note" text="Note for the team">
                      <input id="bd-note" name="note" className="pv-input" placeholder="Optional" />
                    </Fld>
                  </Form>
                </details>
                <details style={{ marginTop: 10 }}>
                  <summary style={summary}>Notes for the hospitality team</summary>
                  <Form action={saveMyNotes} submit="Save notes">
                    <input type="hidden" name="lot_id" value={lot.id} />
                    <textarea
                      name="notes"
                      className="pv-input"
                      rows={4}
                      defaultValue={lot.listing_notes ?? ""}
                      aria-label="Notes for the hospitality team"
                      placeholder="House rules, check-in instructions, what you want kept private"
                    />
                  </Form>
                </details>
                <p style={{ ...muted, fontSize: 13.5, marginBottom: 0 }}>
                  Rates and listing details are managed with the team. Message us to change them.
                </p>
              </>
            ) : (
              <p style={{ ...muted, margin: 0 }}>
                Not listed. Stewards in the active stewardship programme can offer their home to guests when they’re
                away. Ask the team how it works.
              </p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}

function MemberForm({ lotId, m, first }: { lotId: string; m?: Tables<"lot_household">; first?: boolean }) {
  const toast = useToast();
  const [busy, start] = useTransition();
  const p = m?.id ?? "new";
  return (
    <>
      <Form action={saveMyHousehold} submit={m ? "Save" : "Add"} reset={!m}>
        <input type="hidden" name="lot_id" value={lotId} />
        {m && <input type="hidden" name="id" value={m.id} />}
        <Fld id={`${p}-n`} text="Name">
          <input id={`${p}-n`} name="name" className="pv-input" required defaultValue={m?.name ?? ""} />
        </Fld>
        <Fld id={`${p}-r`} text="Relation">
          <select id={`${p}-r`} name="relation" className="pv-input" defaultValue={m?.relation ?? (first ? "owner" : "family")}>
            {RELATIONS.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Fld>
        <Fld id={`${p}-e`} text="Email">
          <input id={`${p}-e`} name="email" type="email" className="pv-input" defaultValue={m?.email ?? ""} />
        </Fld>
        <Fld id={`${p}-p`} text="Phone or WhatsApp">
          <input id={`${p}-p`} name="phone" type="tel" className="pv-input" defaultValue={m?.phone ?? ""} />
        </Fld>
        <Fld id={`${p}-y`} text="Year born">
          <input id={`${p}-y`} name="birth_year" type="number" min={1900} max={2100} className="pv-input" defaultValue={m?.birth_year ?? ""} placeholder="Optional" />
        </Fld>
        <label className="pv-switch">
          <input type="checkbox" name="lives_on_site" defaultChecked={m?.lives_on_site ?? true} />
          <span>Lives on site</span>
        </label>
        <Fld id={`${p}-o`} text="Notes">
          <textarea id={`${p}-o`} name="notes" className="pv-input" rows={2} defaultValue={m?.notes ?? ""} placeholder="Allergies, pets, anything the team should know" />
        </Fld>
      </Form>
      {m && (
        <button
          type="button"
          className="pv-btn ghost sm"
          style={{ marginTop: 8 }}
          disabled={busy}
          onClick={() =>
            start(async () => {
              const fd = new FormData();
              fd.set("intent", "delete");
              fd.set("id", m.id);
              fd.set("lot_id", lotId);
              const r = await saveMyHousehold({ ok: false }, fd);
              toast(r.ok ? (r.message ?? "Removed") : (r.error ?? "Couldn’t remove"));
            })
          }
        >
          Remove
        </button>
      )}
    </>
  );
}
