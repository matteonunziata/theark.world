"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ConfirmButton, Drawer, useDrawer } from "@/components/drawer";
import { useToast } from "@/components/toast";
import type { ActionResult } from "@/lib/action-result";
import { coverUrl } from "@/lib/covers";
import {
  addDays,
  DOW,
  dow,
  fmtDate,
  pd,
  timeRange,
} from "@/lib/dates";
import { createClient } from "@/lib/supabase/client";
import {
  kindName,
  money,
  type Offering,
  sessions,
  type TicketType,
  whenLabel,
} from "@/lib/schedule";
import {
  addBooking,
  emailTicket,
  removeBooking,
  saveOffering,
  setPaid,
  toggleSession,
} from "./actions";
import type { EventsData } from "./data";

const LOCATIONS = ["The Shala", "Spa deck", "Cowork lounge", "Courts", "Gym", "The House", "Farm"];

type Reg = EventsData["registrations"][number];
type Person = EventsData["team"][number];

export function EventsView({
  mode,
  weekStart: ws,
  today,
  staff,
  offerings,
  tickets,
  cancellations,
  registrations,
  team,
}: EventsData & { mode: "week" | "all"; weekStart: string; today: string }) {
  const offering = useDrawer<Offering>();
  const [newKind, setNewKind] = useState<"class" | "event">("class");
  const [session, setSession] = useState<{ id: string; date: string } | null>(null);
  const [kind, setKind] = useState("");
  const canCreate = staff.role === "admin" || staff.role === "lead";
  const canManage = (o: Offering) =>
    canCreate || (staff.role === "facilitator" && o.facilitator_id === staff.id);
  const person = (id: string | null) => team.find((m) => m.id === id);
  const regsFor = (oid: string, d: string) =>
    registrations.filter((r) => r.offering_id === oid && r.session_date === d);

  const startNew = (k: "class" | "event") => {
    setNewKind(k);
    offering.openNew();
  };

  const we = addDays(ws, 6);
  const week = sessions(offerings, cancellations, ws, we);
  const open = session && offerings.find((o) => o.id === session.id);

  return (
    <>
      <div className="toolbar">
        {mode === "week" ? (
          <div className="weeknav" style={{ margin: 0, flex: 1 }}>
            <span className="range">
              {fmtDate(ws, { month: "short", day: "numeric" })} –{" "}
              {fmtDate(we, { month: "short", day: "numeric", year: "numeric" })}
            </span>
            <Link className="btn" href={`/events?week=${addDays(ws, -7)}`}>Previous</Link>
            <Link className="btn" href="/events">This week</Link>
            <Link className="btn" href={`/events?week=${addDays(ws, 7)}`}>Next</Link>
          </div>
        ) : (
          <select
            className="field-in"
            aria-label="Filter by type"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="">Classes and events</option>
            <option value="class">Classes</option>
            <option value="event">Events</option>
          </select>
        )}
        {canCreate && (
          <div className="head-actions" style={{ marginLeft: "auto" }}>
            <button type="button" className="btn" onClick={() => startNew("event")}>
              New event
            </button>
            <button type="button" className="btn primary" onClick={() => startNew("class")}>
              New class
            </button>
          </div>
        )}
      </div>

      {mode === "week" ? (
        <>
          <div className="week">
            {Array.from({ length: 7 }, (_, i) => {
              const d = addDays(ws, i);
              const list = week.filter((s) => s.date === d);
              return (
                <div className={`day ${d === today ? "today" : ""}`} key={d}>
                  <header>
                    <b>{DOW[dow(d)]}</b>
                    <span>{pd(d).getUTCDate()}</span>
                  </header>
                  {list.length ? (
                    list.map((s) => {
                      const f = person(s.o.facilitator_id);
                      const n = regsFor(s.o.id, d).length;
                      return (
                        <button
                          type="button"
                          key={s.o.id}
                          className={`sess ${s.o.kind === "event" ? "event" : ""} ${s.o.status !== "published" ? "draft" : ""} ${s.cancelled ? "cancelled" : ""}`}
                          onClick={() => setSession({ id: s.o.id, date: d })}
                        >
                          <span className="tm">
                            {timeRange(s.o)}
                            {s.cancelled ? ", cancelled" : ""}
                          </span>
                          <b>{s.o.title}</b>
                          {f && <span className="by">{f.name}</span>}
                          <span className="cap">
                            {n}
                            {s.o.capacity ? ` / ${s.o.capacity}` : ""} booked
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <span className="none">Nothing scheduled</span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="legend">
            <span><i style={{ background: "var(--leaf)" }} />Class</span>
            <span><i style={{ background: "var(--sun)" }} />Event</span>
            <span><i style={{ outline: "1px dashed var(--muted)", background: "transparent" }} />Draft, staff only</span>
          </div>
        </>
      ) : !offerings.length ? (
        <div className="empty">
          <h2>No classes or events yet</h2>
          <p>
            Add a weekly class like Vinyasa yoga or Muay Thai, or a one-off
            event like a farm dinner.
          </p>
          {canCreate && (
            <>
              <button type="button" className="btn primary" onClick={() => startNew("class")}>
                New class
              </button>{" "}
              <button type="button" className="btn" onClick={() => startNew("event")}>
                New event
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="list">
          <div className="row head orow">
            <span>Name</span>
            <span className="c-when">When</span>
            <span className="c-fac">Facilitator</span>
            <span>Status</span>
          </div>
          {offerings
            .filter((o) => !kind || o.kind === kind)
            .map((o) => {
              const f = person(o.facilitator_id);
              return (
                <button
                  type="button"
                  className="row orow"
                  key={o.id}
                  onClick={() => offering.openItem(o)}
                >
                  <span className="who" style={{ display: "block" }}>
                    <b>{o.title}</b>
                    <span className={`kind ${o.kind === "event" ? "event" : ""}`}>
                      <i />
                      {kindName(o.kind)}
                      {o.location ? `, ${o.location}` : ""}
                      {o.kind === "event" && o.access === "everyone" ? ", public" : ""}
                    </span>
                  </span>
                  <span className="c-when">{whenLabel(o)}</span>
                  <span className={`c-fac ${f ? "" : "muted"}`}>{f ? f.name : "Unassigned"}</span>
                  <span className={`status ${o.status === "published" ? "on" : "off"}`}>
                    {o.status === "published" ? "Published" : "Draft"}
                  </span>
                </button>
              );
            })}
        </div>
      )}

      <OfferingDrawer
        key={offering.item?.id ?? `new-${newKind}`}
        open={offering.open}
        o={offering.item}
        kind={newKind}
        team={team}
        tickets={tickets.filter((t) => t.offering_id === offering.item?.id)}
        canEdit={offering.item ? canManage(offering.item) : canCreate}
        canDelete={canCreate}
        today={today}
        onClose={offering.close}
      />
      {open && session && (
        <SessionDrawer
          key={`${session.id}-${session.date}`}
          o={open}
          date={session.date}
          today={today}
          cancelled={cancellations.some(
            (c) => c.offering_id === open.id && c.session_date === session.date,
          )}
          regs={regsFor(open.id, session.date)}
          tickets={tickets.filter((t) => t.offering_id === open.id)}
          facilitator={person(open.facilitator_id)}
          canManage={canManage(open)}
          onEdit={() => {
            setSession(null);
            offering.openItem(open);
          }}
          onClose={() => setSession(null)}
        />
      )}
    </>
  );
}

/* ---------- Class / event editor ---------- */

type DraftTicket = Partial<TicketType> & { key: number };

function OfferingDrawer({
  open,
  o,
  kind,
  team,
  tickets,
  canEdit,
  canDelete,
  today,
  onClose,
}: {
  open: boolean;
  o: Offering | null;
  kind: "class" | "event";
  team: Person[];
  tickets: TicketType[];
  canEdit: boolean;
  canDelete: boolean;
  today: string;
  onClose: () => void;
}) {
  const k = (o?.kind ?? kind) as "class" | "event";
  const [curKind, setCurKind] = useState(k);
  const [repeat, setRepeat] = useState(o?.repeat ?? (k === "class" ? "weekly" : "none"));
  const [rows, setRows] = useState<DraftTicket[]>(tickets.map((t, i) => ({ ...t, key: i })));
  const [nextKey, setNextKey] = useState(rows.length);
  const [cover, setCover] = useState(o?.cover_path ?? "");
  const [uploading, setUploading] = useState(false);
  const toast = useToast();
  const days = o?.days ?? [dow(today)];
  const facs = team.filter((m) => m.type === "facilitator");
  const others = team.filter((m) => m.type !== "facilitator");

  async function upload(file: File) {
    setUploading(true);
    try {
      const blob = await resizeImage(file, 1600);
      const path = `${crypto.randomUUID()}.jpg`;
      const { error } = await createClient()
        .storage.from("covers")
        .upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      setCover(path);
    } catch {
      toast("Couldn’t upload that photo. Try a JPG or PNG under 10 MB.");
    }
    setUploading(false);
  }

  return (
    <Drawer
      title={o ? `Edit ${kindName(k).toLowerCase()}` : `New ${kindName(k).toLowerCase()}`}
      open={open}
      onClose={onClose}
      action={saveOffering}
      footer={
        canEdit && (
          <>
            {o && canDelete && <ConfirmButton />}
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={uploading}>
              {o ? "Save changes" : `Create ${kindName(k).toLowerCase()}`}
            </button>
          </>
        )
      }
    >
      <fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0 }}>
        {o && <input type="hidden" name="id" value={o.id} />}
        <input type="hidden" name="cover_path" value={cover} />
        <div className="fld">
          <label htmlFor="e-title">Name</label>
          <input id="e-title" name="title" defaultValue={o?.title} required placeholder={k === "event" ? "e.g. Farm-to-table dinner" : "e.g. Vinyasa yoga"} />
        </div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="e-kind">Type</label>
            <select id="e-kind" name="kind" value={curKind} onChange={(e) => setCurKind(e.target.value as "class" | "event")}>
              <option value="class">Class</option>
              <option value="event">Event</option>
            </select>
          </div>
          <div className="fld">
            <label htmlFor="e-status">Visibility</label>
            <select id="e-status" name="status" defaultValue={o?.status ?? "published"}>
              <option value="published">Published on portal</option>
              <option value="draft">Draft, staff only</option>
            </select>
          </div>
        </div>
        <div className="fld">
          <label htmlFor="e-desc">Description</label>
          <textarea id="e-desc" name="description" defaultValue={o?.description ?? ""} placeholder="What to expect, what to bring" />
        </div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="e-fac">Facilitator</label>
            <select id="e-fac" name="facilitator_id" defaultValue={o?.facilitator_id ?? ""}>
              <option value="">Unassigned</option>
              {facs.length > 0 && (
                <optgroup label="Facilitators">
                  {facs.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </optgroup>
              )}
              {others.length > 0 && (
                <optgroup label="Rest of team">
                  {others.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          <div className="fld">
            <label htmlFor="e-loc">Location</label>
            <input id="e-loc" name="location" list="locs" defaultValue={o?.location ?? ""} placeholder="e.g. The Shala" />
            <datalist id="locs">
              {LOCATIONS.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="subhead">When</div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="e-repeat">Repeats</label>
            <select id="e-repeat" name="repeat" value={repeat} onChange={(e) => setRepeat(e.target.value)}>
              <option value="weekly">Weekly</option>
              <option value="none">Doesn’t repeat</option>
            </select>
          </div>
          <div className="fld">
            <label htmlFor="e-date">{repeat === "weekly" ? "Starts on" : "Date"}</label>
            <input id="e-date" name="start_date" type="date" defaultValue={o?.start_date ?? today} required />
          </div>
        </div>
        {repeat === "weekly" && (
          <>
            <fieldset className="fld" style={{ border: 0, padding: 0 }}>
              <legend style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 6 }}>On these days</legend>
              <div className="daypick">
                {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                  <label key={d}>
                    <input type="checkbox" name="days" value={d} defaultChecked={days.includes(d)} />
                    <span>{DOW[d]}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="fld">
              <label htmlFor="e-end">Repeats until</label>
              <input id="e-end" name="end_date" type="date" defaultValue={o?.end_date ?? ""} />
              <span className="hint">Leave empty to keep it on the schedule.</span>
            </div>
          </>
        )}
        <div className="grid2">
          <div className="fld">
            <label htmlFor="e-st">Starts</label>
            <input id="e-st" name="start_time" type="time" defaultValue={o?.start_time?.slice(0, 5) ?? (k === "class" ? "08:00" : "18:00")} />
          </div>
          <div className="fld">
            <label htmlFor="e-et">Ends</label>
            <input id="e-et" name="end_time" type="time" defaultValue={o?.end_time?.slice(0, 5) ?? (k === "class" ? "09:00" : "21:00")} />
          </div>
        </div>

        <div className="subhead">Spots &amp; tickets</div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="e-cap">Capacity per session</label>
            <input id="e-cap" name="capacity" type="number" min={1} defaultValue={o?.capacity ?? ""} placeholder="No limit" />
          </div>
          <div className="fld">
            <label htmlFor="e-acc">Who can book</label>
            {curKind === "class" ? (
              <>
                <input id="e-acc" readOnly value="Members only" />
                <span className="hint">Classes are for members.</span>
              </>
            ) : (
              <select id="e-acc" name="access" defaultValue={o?.access ?? "everyone"}>
                <option value="everyone">Open to everyone</option>
                <option value="members">Members only</option>
              </select>
            )}
          </div>
        </div>
        <p className="subhint">
          Add ticket types for paid or guest entry. Leave empty if it’s free or
          included in membership. Payment links open after someone books.
        </p>
        {rows.map((t) => (
          <div className="trow" key={t.key}>
            <input type="hidden" name="t_id" value={t.id ?? ""} />
            <input name="t_name" placeholder="Ticket name, e.g. Guest" defaultValue={t.name ?? ""} aria-label="Ticket name" />
            <input name="t_price" type="number" min={0} step="any" placeholder="Price" defaultValue={t.price ?? ""} aria-label="Price" />
            <select name="t_cur" aria-label="Currency" defaultValue={t.currency ?? "CRC"}>
              <option value="CRC">₡ CRC</option>
              <option value="USD">$ USD</option>
            </select>
            <input name="t_qty" type="number" min={1} placeholder="No limit" defaultValue={t.qty ?? ""} aria-label="Quantity per session" />
            <div className="full">
              <input name="t_link" type="url" placeholder="Payment link (optional), e.g. Stripe" defaultValue={t.payment_link ?? ""} aria-label="Payment link" />
              <button type="button" className="btn ghost" onClick={() => setRows(rows.filter((x) => x.key !== t.key))}>
                Remove
              </button>
            </div>
          </div>
        ))}
        {canEdit && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              setRows([...rows, { key: nextKey, currency: "CRC" }]);
              setNextKey(nextKey + 1);
            }}
          >
            Add ticket type
          </button>
        )}

        <div className="subhead">Cover photo</div>
        <div className="cover-ed">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl(cover) ?? ""} alt="" />
          ) : (
            <div className="ph">No photo</div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <label className="btn" style={{ cursor: "pointer" }}>
              {uploading ? "Uploading…" : cover ? "Replace" : "Add photo"}
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
              />
            </label>
            {cover && (
              <button type="button" className="btn ghost" onClick={() => setCover("")}>
                Remove
              </button>
            )}
          </div>
        </div>

        {o && (
          <>
            <div className="subhead">Share</div>
            <ShareLink path={`/e/${o.id}`} />
          </>
        )}
      </fieldset>
    </Drawer>
  );
}

/* ---------- One session: bookings and actions ---------- */

function SessionDrawer({
  o,
  date,
  today,
  cancelled,
  regs,
  tickets,
  facilitator,
  canManage,
  onEdit,
  onClose,
}: {
  o: Offering;
  date: string;
  today: string;
  cancelled: boolean;
  regs: Reg[];
  tickets: TicketType[];
  facilitator?: Person;
  canManage: boolean;
  onEdit: () => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      const r = await fn();
      toast(r.ok ? (r.message ?? "") : (r.error ?? ""));
    });
  const pct = o.capacity ? Math.min(100, Math.round((regs.length / o.capacity) * 100)) : 0;

  return (
    <Drawer
      title={o.title}
      open
      onClose={onClose}
      action={addBooking}
      footer={
        canManage && (
          <>
            <button type="button" className="btn" onClick={onEdit}>
              Edit
            </button>
            <button
              type="button"
              className="btn"
              disabled={pending}
              onClick={() => run(() => toggleSession(o.id, date, !cancelled))}
            >
              {cancelled ? "Restore session" : "Cancel session"}
            </button>
            <span className="spacer" />
            <button type="submit" className="btn primary" disabled={cancelled}>
              Add booking
            </button>
          </>
        )
      }
    >
      {cancelled && (
        <div className="banner">This session is cancelled. It shows as cancelled on the members portal.</div>
      )}
      {o.status !== "published" && <div className="banner">Draft. Not visible on the members portal.</div>}
      <dl className="info">
        <dt>When</dt>
        <dd>
          {fmtDate(date, { weekday: "long", month: "long", day: "numeric" })}, {timeRange(o)}
        </dd>
        <dt>Facilitator</dt>
        <dd>{facilitator ? facilitator.name : <span className="muted">Unassigned</span>}</dd>
        <dt>Location</dt>
        <dd>{o.location || "—"}</dd>
        <dt>Who can book</dt>
        <dd>{o.access === "members" ? "Members only" : "Open to everyone"}</dd>
        <dt>Booked</dt>
        <dd>
          {regs.length}
          {o.capacity ? ` of ${o.capacity}` : ""}
        </dd>
      </dl>
      {o.capacity ? (
        <div className="meter" aria-hidden="true">
          <span style={{ width: `${pct}%` }} />
        </div>
      ) : null}
      {tickets.map((t) => {
        const sold = regs.filter((r) => r.ticket_type_id === t.id).length;
        return (
          <div className="tk" key={t.id}>
            <div>
              <b>{t.name}</b>
              <span>{money(t.price, t.currency)}</span>
            </div>
            <div>
              {sold} sold{t.qty ? `, ${Math.max(0, t.qty - sold)} left` : ""}
            </div>
          </div>
        );
      })}

      <div className="subhead">Bookings</div>
      {!regs.length ? (
        <p className="muted" style={{ margin: 0 }}>No bookings yet.</p>
      ) : (
        regs.map((r) => {
          const t = tickets.find((x) => x.id === r.ticket_type_id);
          return (
            <div className="att" key={r.id}>
              <div className="nm">
                <b>
                  {r.checked_in_at ? "✓ " : ""}
                  {r.name}
                </b>
                <span>
                  {r.email || "No email"}
                  {t ? `, ${t.name}` : ", member"}
                  {r.source !== "staff" ? ", booked online" : ""}
                </span>
              </div>
              {canManage && t && Number(t.price) > 0 && (
                <label>
                  <input
                    type="checkbox"
                    checked={r.paid}
                    disabled={pending}
                    onChange={(e) => run(() => setPaid(r.id, e.target.checked))}
                  />
                  Paid
                </label>
              )}
              <a className="mini" href={`/t/${r.qr_token}`} target="_blank" rel="noopener noreferrer">
                Ticket
              </a>
              {canManage && r.email && (
                <button type="button" className="mini" disabled={pending} onClick={() => run(() => emailTicket(r.id))}>
                  Email
                </button>
              )}
              {canManage && (
                <button type="button" className="mini" disabled={pending} onClick={() => run(() => removeBooking(r.id))}>
                  Remove
                </button>
              )}
            </div>
          );
        })
      )}

      {canManage && !cancelled && date >= today && (
        <>
          <div className="subhead">Add someone</div>
          <input type="hidden" name="offering_id" value={o.id} />
          <input type="hidden" name="session_date" value={date} />
          <div className="grid2">
            <div className="fld">
              <label htmlFor="a-name">Name</label>
              <input id="a-name" name="name" required />
            </div>
            <div className="fld">
              <label htmlFor="a-email">Email</label>
              <input id="a-email" name="email" type="email" />
              <span className="hint">We email them their ticket.</span>
            </div>
          </div>
          {tickets.length > 0 && (
            <div className="fld">
              <label htmlFor="a-t">Ticket</label>
              <select id="a-t" name="ticket_type_id" defaultValue="">
                <option value="">Member, included</option>
                {tickets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}, {money(t.price, t.currency)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </>
      )}

      <div className="subhead">Share</div>
      <ShareLink path={`/e/${o.id}/${date}`} />
    </Drawer>
  );
}

function ShareLink({ path }: { path: string }) {
  const toast = useToast();
  const url = typeof window === "undefined" ? path : `${window.location.origin}${path}`;
  return (
    <div className="share">
      <input readOnly value={url} aria-label="Share link" />
      <button
        type="button"
        className="btn"
        onClick={() =>
          navigator.clipboard.writeText(url).then(
            () => toast("Link copied"),
            () => toast("Select the link and copy it"),
          )
        }
      >
        Copy link
      </button>
    </div>
  );
}

/** Shrink a photo in the browser before upload. */
async function resizeImage(file: File, max: number): Promise<Blob> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("resize"))), "image/jpeg", 0.85),
  );
}
