"use client";

import Link from "next/link";
import { useState } from "react";
import { ConfirmButton, Drawer, useDrawer } from "@/components/drawer";
import { useToast } from "@/components/toast";
import type { Tables } from "@/lib/database.types";
import { fmtDate } from "@/lib/dates";
import {
  area,
  estatePhoto,
  HOME_STATUS,
  label,
  LOT_KINDS,
  LOT_STATUS,
  lotTitle,
  MAINT_CATEGORIES,
  MAINT_STATUS,
  nights,
  RELATIONS,
  STAY_KINDS,
  statusTone,
} from "@/lib/estate";
import { money } from "@/lib/schedule";
import { type Stay, StayDrawer } from "../../hospitality/stay-drawer";
import { addSteward, removeSteward, saveHousehold, saveLot, saveMaintenance, setHospitality } from "../actions";
import { LotFields } from "../lot-fields";

const TABS = [
  ["overview", "Overview"],
  ["financials", "Financials"],
  ["schedule", "Schedule"],
  ["maintenance", "Maintenance log"],
] as const;

type Lot = Tables<"lots">;
type Member = Tables<"lot_household">;
type Log = Tables<"lot_maintenance"> & { logged_by: string | null };
type Person = { id: string; name: string };
type LotRef = { id: string; code: string; name: string | null; estate_lot_id: string | null };

export function LotView({
  lot,
  stewards,
  household,
  logs,
  stays,
  people,
  lots,
  today,
  tab,
}: {
  lot: Lot;
  stewards: { id: string; name: string; email: string | null; phone: string | null }[];
  tab: string;
  household: Member[];
  logs: Log[];
  stays: Stay[];
  people: Person[];
  lots: LotRef[];
  today: string;
}) {
  const estate = lots.find((l) => l.id === lot.estate_lot_id);
  const parts = lots.filter((l) => l.estate_lot_id === lot.id);
  const edit = useDrawer<null>();
  const hosp = useDrawer<null>();
  const fam = useDrawer<Member>();
  const log = useDrawer<Log>();
  const stay = useDrawer<Stay>();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [newSteward, setNewSteward] = useState("");
  const steward = async (run: () => Promise<{ ok: boolean; message?: string; error?: string }>) => {
    setBusy(true);
    const r = await run();
    setBusy(false);
    toast(r.ok ? (r.message ?? "Saved") : (r.error ?? "Couldn’t save"));
  };
  const hospitality = async (on: boolean) => {
    setBusy(true);
    const r = await setHospitality(lot.id, on);
    setBusy(false);
    toast(r.ok ? (r.message ?? "Saved") : (r.error ?? "Couldn’t save"));
    if (r.ok && !on) hosp.close();
  };
  const photo = estatePhoto(lot.photo_path);
  const aerial = estatePhoto(lot.aerial_path);
  const sold = lot.status === "sold" || lot.status === "not_for_sale";
  const open = logs.filter((l) => l.status !== "done");
  const spent = logs
    .filter((l) => l.status === "done" && l.cost)
    .reduce<Record<string, number>>((a, l) => ({ ...a, [l.currency]: (a[l.currency] ?? 0) + Number(l.cost) }), {});
  const homeLine = [
    lot.bedrooms !== null ? `${lot.bedrooms} bed` : null,
    lot.bathrooms !== null ? `${Number(lot.bathrooms)} bath` : null,
    area(lot.built_m2) ? `${area(lot.built_m2)} built` : null,
  ].filter(Boolean);

  return (
    <>
      <p style={{ margin: "0 0 14px" }}>
        <Link href="/estate" className="muted">← Inventory</Link>
        <span className="muted"> · </span>
        <Link href={`/estate/map?lot=${lot.code}`} className="muted">See on the map</Link>
      </p>
      <div className="lot-head">
        <div>
          <h1>{lotTitle(lot)}</h1>
          <p className="lede" style={{ margin: "4px 0 0" }}>
            {[lot.name ? `Lot ${lot.code}` : null, lot.zone, area(lot.size_m2)].filter(Boolean).join(" · ")}
            <span className="lot-pill inline" style={{ ["--tone" as string]: statusTone[lot.status] }}>
              {label(LOT_STATUS, lot.status)}
            </span>
            {lot.in_hospitality && <span className="lot-pill inline hosp">Hospitality</span>}
          </p>
        </div>
        <button type="button" className="btn" style={{ marginLeft: "auto", alignSelf: "flex-start" }} onClick={edit.openNew}>
          Edit lot
        </button>
      </div>

      <nav className="tabs" aria-label="Property">
        {TABS.map(([key, text]) => (
          <Link key={key} href={key === "overview" ? `/estate/${lot.id}` : `/estate/${lot.id}?tab=${key}`} aria-current={tab === key ? "page" : undefined}>
            {text}
          </Link>
        ))}
      </nav>

      {tab === "maintenance" && 
          <section className="panel">
            <h2>
              Maintenance log
              <button type="button" className="btn primary sm" onClick={log.openNew}>Log work</button>
            </h2>
            {(open.length > 0 || Object.keys(spent).length > 0) && (
              <p className="muted" style={{ margin: "-4px 0 10px", fontSize: 13.5 }}>
                {open.length ? `${open.length} open or scheduled. ` : ""}
                {Object.keys(spent).length
                  ? `Spent so far: ${Object.entries(spent).map(([c, v]) => money(v, c)).join(" and ")}.`
                  : ""}
              </p>
            )}
            {!logs.length ? (
              <p className="muted" style={{ margin: 0 }}>Nothing logged yet. Record repairs, garden and pool work, inspections, and what they cost.</p>
            ) : (
              <div className="mlog">
                {logs.map((l) => (
                  <button key={l.id} type="button" className="mlog-row" onClick={() => log.openItem(l)}>
                    <span className="d">{fmtDate(l.performed_on, { month: "short", day: "numeric", year: "numeric" })}</span>
                    <span>
                      <b>{l.title}</b>
                      <span className="muted">
                        {" "}· {label(MAINT_CATEGORIES, l.category)}
                        {l.done_by ? ` · ${l.done_by}` : ""}
                      </span>
                      {l.details && <span className="det">{l.details}</span>}
                    </span>
                    <span className="r">
                      {l.status !== "done" && <span className={`tag-sm ${l.status === "open" ? "low" : ""}`}>{label(MAINT_STATUS, l.status)}</span>}
                      {l.cost !== null && <span className="amt">{money(l.cost, l.currency)}</span>}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
}
      {(tab === "financials" || tab === "schedule") && (
        <section className="panel">
          <h2>{tab === "financials" ? "Financials" : "Schedule"}</h2>
          <p className="muted" style={{ margin: 0 }}>
            {tab === "financials"
              ? "What the steward owes The ARK, and what The ARK owes them, will live here."
              : "Hospitality availability and maintenance services for this property will live here."}
          </p>
        </section>
      )}

      {tab === "overview" && (
        <>
      <div className="lot-photos">
        {[
          ["Lot and home", photo],
          ["Aerial view", aerial],
        ].map(([title, src]) => (
          <figure key={title}>
            {src ? (
              <a href={src} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`${title}, ${lotTitle(lot)}`} />
              </a>
            ) : (
              <button type="button" className="ph" onClick={edit.openNew}>Add a photo</button>
            )}
            <figcaption>{title}</figcaption>
          </figure>
        ))}
      </div>

      <div className="student-grid">
        <div style={{ display: "grid", gap: 16 }}>
          <section className="panel">
            <h2>The lot</h2>
            <dl className="kv">
              {lot.kind !== "lot" && (
                <>
                  <dt>Type</dt>
                  <dd>{label(LOT_KINDS, lot.kind)}</dd>
                </>
              )}
              {lot.features && (
                <>
                  <dt>Specifications</dt>
                  <dd>{lot.features}</dd>
                </>
              )}
              {estate && (
                <>
                  <dt>Sold with</dt>
                  <dd>
                    <Link href={`/estate/${estate.id}`}>{estate.name ? `${estate.name} (Lot ${estate.code})` : `Lot ${estate.code}`}</Link>
                  </dd>
                </>
              )}
              {parts.length > 0 && (
                <>
                  <dt>Includes</dt>
                  <dd>
                    {parts.map((p, i) => (
                      <span key={p.id}>
                        {i > 0 && ", "}
                        <Link href={`/estate/${p.id}`}>Lot {p.code}</Link>
                      </span>
                    ))}
                  </dd>
                </>
              )}
              <dt>Size</dt>
              <dd>{area(lot.size_m2) ?? "—"}</dd>
              <dt>Status</dt>
              <dd>{label(LOT_STATUS, lot.status)}</dd>
              {!sold && !estate && (
                <>
                  <dt>Price</dt>
                  <dd>{lot.price !== null ? money(lot.price, lot.currency) : "Not set"}</dd>
                </>
              )}
              <dt>{stewards.length > 1 ? "Stewards" : "Steward"}</dt>
              <dd>
                {stewards.length ? (
                  stewards.map((o, i) => (
                    <span key={o.id}>
                      {i > 0 && ", "}
                      <Link href={`/crm/contact/${o.id}`}>{o.name}</Link>
                    </span>
                  ))
                ) : (
                  "—"
                )}
              </dd>
              {lot.zone && (
                <>
                  <dt>Zone</dt>
                  <dd>{lot.zone}</dd>
                </>
              )}
            </dl>
            {lot.description && <p style={{ whiteSpace: "pre-line", fontSize: 14, margin: "14px 0 0" }}>{lot.description}</p>}
          </section>

          <section className="panel">
            <h2>The home</h2>
            {lot.home_status === "none" ? (
              <p className="muted" style={{ margin: 0 }}>No home on this lot yet.</p>
            ) : (
              <>
                <p style={{ margin: "0 0 6px" }}>
                  <b>{lot.home_name ?? "Home"}</b>
                  <span className="muted"> · {label(HOME_STATUS, lot.home_status)}</span>
                </p>
                {homeLine.length > 0 && <p className="muted" style={{ margin: 0 }}>{homeLine.join(" · ")}</p>}
                {lot.home_notes && <p style={{ whiteSpace: "pre-line", fontSize: 14, margin: "10px 0 0" }}>{lot.home_notes}</p>}
              </>
            )}
          </section>
        </div>

        <aside className="student-side">
          <section className="card">
            <h2>{stewards.length > 1 ? "Stewards" : "Steward"}</h2>
            {stewards.length ? (
              stewards.map((o) => (
                <div key={o.id} className="fam" style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span>
                    <Link href={`/crm/contact/${o.id}`}><b>{o.name}</b></Link>
                    {o.id === lot.owner_contact_id && <span className="muted"> · primary</span>}
                    <span className="muted" style={{ display: "block", fontSize: 13 }}>
                      {[o.email, o.phone].filter(Boolean).join(" · ") || " "}
                    </span>
                  </span>
                  <button type="button" className="btn ghost sm" disabled={busy} onClick={() => steward(() => removeSteward(lot.id, o.id))}>
                    Remove
                  </button>
                </div>
              ))
            ) : (
              <p className="muted" style={{ fontSize: 13.5 }}>No steward linked yet.</p>
            )}
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <select aria-label="Add a steward" value={newSteward} onChange={(e) => setNewSteward(e.target.value)} style={{ flex: 1 }}>
                <option value="">Add a steward…</option>
                {people.filter((p) => !stewards.some((o) => o.id === p.id)).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <button type="button" className="btn sm" disabled={busy || !newSteward} onClick={() => steward(() => addSteward(lot.id, newSteward)).then(() => setNewSteward(""))}>
                Add
              </button>
            </div>
          </section>

          <section className="card">
            <h2>Household</h2>
            {household.length ? (
              household.map((m) => (
                <button key={m.id} type="button" className="fam" onClick={() => fam.openItem(m)}>
                  <b>{m.name}</b>
                  <span className="muted"> · {label(RELATIONS, m.relation)}</span>
                  {!m.lives_on_site && <span className="muted"> · not on site</span>}
                  <span className="muted" style={{ display: "block", fontSize: 13 }}>
                    {[m.birth_year ? `Born ${m.birth_year}` : null, m.email, m.phone].filter(Boolean).join(" · ") || " "}
                  </span>
                </button>
              ))
            ) : (
              <p className="muted" style={{ fontSize: 13.5 }}>No one listed yet. Add the family who live here.</p>
            )}
            <button type="button" className="btn ghost sm" onClick={fam.openNew}>Add a person</button>
          </section>

          <section className="card">
            <h2>Hospitality</h2>
            {lot.in_hospitality ? (
              <>
                <p style={{ fontSize: 14, margin: "0 0 8px" }}>
                  In the active stewardship programme{lot.hospitality_since ? ` since ${fmtDate(lot.hospitality_since, { month: "long", year: "numeric" })}` : ""}.
                </p>
                <p className="muted" style={{ fontSize: 13.5, margin: "0 0 10px" }}>
                  {[
                    lot.nightly_rate !== null ? `${money(lot.nightly_rate, lot.rate_currency)} a night` : "No rate set",
                    lot.max_guests ? `up to ${lot.max_guests} guests` : null,
                    lot.min_nights > 1 ? `${lot.min_nights}-night minimum` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {stays.length ? (
                  <div style={{ marginBottom: 10 }}>
                    {stays.slice(0, 5).map((s) => (
                      <button key={s.id} type="button" className="fam" onClick={() => stay.openItem(s)}>
                        <b>{s.kind === "guest" ? s.guest_name : label(STAY_KINDS, s.kind)}</b>
                        {s.status === "inquiry" && <span className="muted"> · inquiry</span>}
                        <span className="muted" style={{ display: "block", fontSize: 13 }}>
                          {fmtDate(s.check_in)} – {fmtDate(s.check_out)} · {nights(s.check_in, s.check_out)} nights
                          {s.check_in <= today ? " · here now" : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="muted" style={{ fontSize: 13.5 }}>No upcoming stays.</p>
                )}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" className="btn primary sm" onClick={stay.openNew}>Book a stay</button>
                  <Link className="btn sm" href={`/hospitality?lot=${lot.id}`}>Calendar</Link>
                  <button type="button" className="btn ghost sm" onClick={hosp.openNew}>Settings</button>
                </div>
              </>
            ) : (
              <>
                <p className="muted" style={{ fontSize: 13.5 }}>
                  Not listed. Owners in the active stewardship programme can offer their home to guests when they’re away.
                </p>
                <button type="button" className="btn sm" disabled={busy} onClick={() => hospitality(true)}>
                  {busy ? "Adding…" : "Add to hospitality"}
                </button>
              </>
            )}
          </section>
        </aside>
      </div>
        </>
      )}

      <Drawer
        title="Edit lot"
        open={edit.open}
        onClose={edit.close}
        action={saveLot}
        footer={
          <>
            <ConfirmButton />
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={edit.close}>Cancel</button>
            <button type="submit" className="btn primary">Save</button>
          </>
        }
      >
        <LotFields lot={lot} people={people} lots={lots} />
      </Drawer>

      <Drawer
        title="Hospitality"
        open={hosp.open}
        onClose={hosp.close}
        action={saveLot}
        footer={
          <>
            <button type="button" className="btn danger" disabled={busy} onClick={() => hospitality(false)}>
              Remove from hospitality
            </button>
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={hosp.close}>Cancel</button>
            <button type="submit" className="btn primary">Save</button>
          </>
        }
      >
        <input type="hidden" name="id" value={lot.id} />
        <input type="hidden" name="code" value={lot.code} />
        <input type="hidden" name="hospitality_form" value="1" />
        <input type="hidden" name="in_hospitality" value="on" />
        <div className="grid2">
          <div className="fld">
            <label htmlFor="h-rate">Nightly rate</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input id="h-rate" name="nightly_rate" inputMode="decimal" defaultValue={lot.nightly_rate ?? ""} style={{ flex: 1 }} />
              <select name="rate_currency" aria-label="Currency" defaultValue={lot.rate_currency} style={{ width: 84 }}>
                <option>USD</option>
                <option>CRC</option>
              </select>
            </div>
          </div>
          <div className="fld">
            <label htmlFor="h-since">In the programme since</label>
            <input id="h-since" name="hospitality_since" type="date" defaultValue={lot.hospitality_since ?? today} />
          </div>
        </div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="h-guests">Sleeps</label>
            <input id="h-guests" name="max_guests" type="number" min={1} defaultValue={lot.max_guests ?? ""} />
          </div>
          <div className="fld">
            <label htmlFor="h-min">Minimum nights</label>
            <input id="h-min" name="min_nights" type="number" min={1} defaultValue={lot.min_nights} />
          </div>
        </div>
        <div className="fld">
          <label htmlFor="h-notes">Notes for the hospitality team</label>
          <textarea id="h-notes" name="listing_notes" rows={4} defaultValue={lot.listing_notes ?? ""} placeholder="House rules, check-in instructions, what the owner wants kept private" />
        </div>
      </Drawer>

      <Drawer
        key={fam.item?.id ?? "new-fam"}
        title={fam.item ? "Edit household member" : "Add to the household"}
        open={fam.open}
        onClose={fam.close}
        action={saveHousehold}
        footer={
          <>
            {fam.item && <ConfirmButton label="Remove" />}
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={fam.close}>Cancel</button>
            <button type="submit" className="btn primary">Save</button>
          </>
        }
      >
        <input type="hidden" name="lot_id" value={lot.id} />
        {fam.item && <input type="hidden" name="id" value={fam.item.id} />}
        <div className="grid2">
          <div className="fld">
            <label htmlFor="hh-name">Name</label>
            <input id="hh-name" name="name" required defaultValue={fam.item?.name ?? ""} />
          </div>
          <div className="fld">
            <label htmlFor="hh-rel">Relation</label>
            <select id="hh-rel" name="relation" defaultValue={fam.item?.relation ?? (household.length ? "family" : "owner")}>
              {RELATIONS.map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="hh-email">Email</label>
            <input id="hh-email" name="email" type="email" defaultValue={fam.item?.email ?? ""} />
          </div>
          <div className="fld">
            <label htmlFor="hh-phone">Phone or WhatsApp</label>
            <input id="hh-phone" name="phone" type="tel" defaultValue={fam.item?.phone ?? ""} />
          </div>
        </div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="hh-year">Year born</label>
            <input id="hh-year" name="birth_year" type="number" min={1900} max={2100} defaultValue={fam.item?.birth_year ?? ""} placeholder="Optional" />
          </div>
          <div className="fld">
            <label htmlFor="hh-contact">In the CRM</label>
            <select id="hh-contact" name="contact_id" defaultValue={fam.item?.contact_id ?? ""}>
              <option value="">Not linked</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
        <label className="check" style={{ marginBottom: 14 }}>
          <input type="checkbox" name="lives_on_site" defaultChecked={fam.item?.lives_on_site ?? true} />
          Lives on site
        </label>
        <div className="fld">
          <label htmlFor="hh-notes">Notes</label>
          <textarea id="hh-notes" name="notes" rows={3} defaultValue={fam.item?.notes ?? ""} placeholder="School, allergies, pets, anything the team should know" />
        </div>
      </Drawer>

      <Drawer
        key={log.item?.id ?? "new-log"}
        title={log.item ? "Edit log entry" : "Log work"}
        open={log.open}
        onClose={log.close}
        action={saveMaintenance}
        footer={
          <>
            {log.item && <ConfirmButton />}
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={log.close}>Cancel</button>
            <button type="submit" className="btn primary">Save</button>
          </>
        }
      >
        <input type="hidden" name="lot_id" value={lot.id} />
        {log.item && <input type="hidden" name="id" value={log.item.id} />}
        <div className="fld">
          <label htmlFor="m-title">What was done</label>
          <input id="m-title" name="title" required defaultValue={log.item?.title ?? ""} placeholder="e.g. Pool pump replaced" />
        </div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="m-cat">Type</label>
            <select id="m-cat" name="category" defaultValue={log.item?.category ?? "repair"}>
              {MAINT_CATEGORIES.map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label htmlFor="m-status">Status</label>
            <select id="m-status" name="status" defaultValue={log.item?.status ?? "done"}>
              {MAINT_STATUS.map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="m-date">Date</label>
            <input id="m-date" name="performed_on" type="date" defaultValue={log.item?.performed_on ?? today} />
          </div>
          <div className="fld">
            <label htmlFor="m-by">Done by</label>
            <input id="m-by" name="done_by" defaultValue={log.item?.done_by ?? ""} placeholder="Person or company" />
          </div>
        </div>
        <div className="fld">
          <label htmlFor="m-cost">Cost</label>
          <div style={{ display: "flex", gap: 6 }}>
            <input id="m-cost" name="cost" inputMode="decimal" defaultValue={log.item?.cost ?? ""} style={{ flex: 1 }} />
            <select name="currency" aria-label="Currency" defaultValue={log.item?.currency ?? "USD"} style={{ width: 84 }}>
              <option>USD</option>
              <option>CRC</option>
            </select>
          </div>
        </div>
        <div className="fld">
          <label htmlFor="m-det">Details</label>
          <textarea id="m-det" name="details" rows={4} defaultValue={log.item?.details ?? ""} />
        </div>
      </Drawer>

      <StayDrawer
        key={stay.item?.id ?? "new-stay"}
        open={stay.open}
        onClose={stay.close}
        stay={stay.item}
        homes={[lot]}
        defaults={{ lot_id: lot.id }}
      />
    </>
  );
}
