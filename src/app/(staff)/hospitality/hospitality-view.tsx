"use client";

import Link from "next/link";
import { useState } from "react";
import { useDrawer } from "@/components/drawer";
import { addDays, DOW, fmtDate } from "@/lib/dates";
import { coversNight, estatePhoto, lotTitle, nights, occupancy, overlaps, STAY_KINDS, label } from "@/lib/estate";
import { money } from "@/lib/schedule";
import { type Home, type Stay, StayDrawer } from "./stay-drawer";

const DAYS = 28;

type HomeRow = Home & { photo_path: string | null; bedrooms: number | null };
type Defaults = { lot_id?: string; check_in?: string; check_out?: string };

export function HospitalityView({
  homes,
  allLots,
  stays,
  today,
  from,
  focus,
}: {
  homes: HomeRow[];
  allLots: Home[];
  stays: Stay[];
  today: string;
  from: string;
  focus: string | null;
}) {
  const drawer = useDrawer<Stay>();
  const [defaults, setDefaults] = useState<Defaults>({});
  const live = stays.filter((s) => s.status !== "cancelled");
  const confirmed = live.filter((s) => s.status === "confirmed");
  const listed = homes.filter((h) => h.in_hospitality);

  const hereNow = confirmed.filter((s) => s.kind === "guest" && coversNight(s, today));
  const arrivals = live
    .filter((s) => s.kind === "guest" && s.check_in >= today && s.check_in <= addDays(today, 14))
    .sort((a, b) => a.check_in.localeCompare(b.check_in));
  const departures = confirmed
    .filter((s) => s.kind === "guest" && s.check_out >= today && s.check_out <= addDays(today, 14))
    .sort((a, b) => a.check_out.localeCompare(b.check_out));
  const inquiries = live.filter((s) => s.status === "inquiry" && s.check_out >= today);
  const occ = occupancy(confirmed, listed.length, today, addDays(today, 30));
  const home = (id: string) => allLots.find((l) => l.id === id);

  const book = (d: Defaults) => {
    setDefaults(d);
    drawer.openNew();
  };

  if (!homes.length) {
    return (
      <div className="empty">
        <h2>No homes in the programme yet</h2>
        <p>
          When an owner joins active stewardship, open their lot in Real estate
          and choose “Add to hospitality”. Their home shows here with a
          calendar, and you can take bookings.
        </p>
        <Link className="btn primary" href="/estate">Go to Real estate</Link>
      </div>
    );
  }

  return (
    <>
      <div className="stats" style={{ marginBottom: 18 }}>
        <div className="stat"><b>{listed.length}</b><span>Homes listed</span></div>
        <div className="stat"><b>{hereNow.length}</b><span>Stays in progress</span></div>
        <div className="stat"><b>{arrivals.filter((s) => s.check_in <= addDays(today, 7)).length}</b><span>Arriving this week</span></div>
        <div className="stat"><b>{Math.round(occ * 100)}%</b><span>Booked, next 30 nights</span></div>
      </div>

      <Availability homes={listed} stays={live} today={today} onBook={book} />

      <Timeline
        homes={focus ? [...homes].sort((a, b) => (a.id === focus ? -1 : b.id === focus ? 1 : 0)) : homes}
        stays={live}
        from={from}
        today={today}
        focus={focus}
        onEmpty={(lotId, date) => book({ lot_id: lotId, check_in: date, check_out: addDays(date, 1) })}
        onStay={drawer.openItem}
      />

      <div className="grid2" style={{ marginTop: 18, alignItems: "start" }}>
        <section className="panel">
          <h2>Arriving soon</h2>
          {!arrivals.length ? (
            <p className="muted" style={{ margin: 0 }}>No arrivals in the next two weeks.</p>
          ) : (
            arrivals.map((s) => (
              <StayLine key={s.id} s={s} home={home(s.lot_id)} date={s.check_in} today={today} onOpen={drawer.openItem} />
            ))
          )}
        </section>
        <section className="panel">
          <h2>Leaving soon</h2>
          {!departures.length ? (
            <p className="muted" style={{ margin: 0 }}>No departures in the next two weeks.</p>
          ) : (
            departures.map((s) => (
              <StayLine key={s.id} s={s} home={home(s.lot_id)} date={s.check_out} today={today} onOpen={drawer.openItem} />
            ))
          )}
          {inquiries.length > 0 && (
            <>
              <h2 style={{ marginTop: 16 }}>Open inquiries</h2>
              {inquiries.map((s) => (
                <StayLine key={s.id} s={s} home={home(s.lot_id)} date={s.check_in} today={today} onOpen={drawer.openItem} />
              ))}
            </>
          )}
        </section>
      </div>

      <StayDrawer
        key={drawer.item?.id ?? `new-${defaults.lot_id}-${defaults.check_in}`}
        open={drawer.open}
        onClose={drawer.close}
        stay={drawer.item}
        homes={allLots}
        defaults={defaults}
      />
    </>
  );
}

function StayLine({
  s,
  home,
  date,
  today,
  onOpen,
}: {
  s: Stay;
  home?: Home;
  date: string;
  today: string;
  onOpen: (s: Stay) => void;
}) {
  return (
    <button type="button" className="stay-line" onClick={() => onOpen(s)}>
      <span className="d">{date === today ? "Today" : fmtDate(date)}</span>
      <span>
        <b>{s.kind === "guest" ? s.guest_name : label(STAY_KINDS, s.kind)}</b>
        <span className="muted">
          {" "}· {home ? lotTitle(home) : "Home"} · {nights(s.check_in, s.check_out)} nights
          {s.guests ? ` · ${s.guests} guests` : ""}
        </span>
      </span>
      {s.status === "inquiry" ? (
        <span className="tag-sm low">Inquiry</span>
      ) : s.kind === "guest" && !s.paid && Number(s.total) > 0 ? (
        <span className="tag-sm">Unpaid</span>
      ) : null}
    </button>
  );
}

function Availability({
  homes,
  stays,
  today,
  onBook,
}: {
  homes: HomeRow[];
  stays: Stay[];
  today: string;
  onBook: (d: Defaults) => void;
}) {
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState("");
  const span = checkIn && checkOut && checkOut > checkIn ? { check_in: checkIn, check_out: checkOut } : null;
  const n = span ? nights(span.check_in, span.check_out) : 0;
  const results = span
    ? homes.map((h) => {
        const clash = stays.filter((s) => s.lot_id === h.id && overlaps(s, span));
        const blocked = clash.some((s) => s.status === "confirmed");
        const tooSmall = !!guests && !!h.max_guests && Number(guests) > h.max_guests;
        const tooShort = n < h.min_nights;
        return { h, blocked, tooSmall, tooShort, inquiry: clash.some((s) => s.status === "inquiry") };
      })
    : [];
  const free = results.filter((r) => !r.blocked && !r.tooSmall && !r.tooShort);

  return (
    <section className="panel" style={{ marginBottom: 18 }}>
      <h2>Check availability</h2>
      <div className="avail-form">
        <label>
          <span className="lbl">Check-in</span>
          <input type="date" className="field-in" min={today} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
        </label>
        <label>
          <span className="lbl">Check-out</span>
          <input type="date" className="field-in" min={checkIn || today} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
        </label>
        <label>
          <span className="lbl">Guests</span>
          <input type="number" className="field-in" min={1} value={guests} onChange={(e) => setGuests(e.target.value)} style={{ width: 90 }} />
        </label>
      </div>
      {span && (
        <>
          <p className="muted" style={{ fontSize: 13.5, margin: "12px 0 8px" }}>
            {free.length} of {homes.length} home{homes.length === 1 ? "" : "s"} free for {n} night{n === 1 ? "" : "s"},{" "}
            {fmtDate(span.check_in)} to {fmtDate(span.check_out)}.
          </p>
          <div className="avail-list">
            {results.map(({ h, blocked, tooSmall, tooShort, inquiry }) => {
              const ok = !blocked && !tooSmall && !tooShort;
              const photo = estatePhoto(h.photo_path);
              return (
                <div key={h.id} className={`avail ${ok ? "" : "no"}`}>
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt="" />
                  ) : (
                    <span className="ph" />
                  )}
                  <span>
                    <b>{lotTitle(h)}</b>
                    <span className="muted" style={{ display: "block", fontSize: 13 }}>
                      {ok
                        ? [
                            h.nightly_rate ? `${money(Number(h.nightly_rate) * n, h.rate_currency)} total` : "No rate set",
                            h.max_guests ? `sleeps ${h.max_guests}` : null,
                            inquiry ? "someone has asked about these dates" : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        : blocked
                          ? "Booked for some of these nights"
                          : tooSmall
                            ? `Sleeps ${h.max_guests}`
                            : `${h.min_nights}-night minimum`}
                    </span>
                  </span>
                  {ok && (
                    <button type="button" className="btn primary sm" onClick={() => onBook({ lot_id: h.id, ...span })}>
                      Book
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function Timeline({
  homes,
  stays,
  from,
  today,
  focus,
  onEmpty,
  onStay,
}: {
  homes: HomeRow[];
  stays: Stay[];
  from: string;
  today: string;
  focus: string | null;
  onEmpty: (lotId: string, date: string) => void;
  onStay: (s: Stay) => void;
}) {
  const days = Array.from({ length: DAYS }, (_, i) => addDays(from, i));
  const to = addDays(from, DAYS);
  const cols = `minmax(130px,170px) repeat(${DAYS}, minmax(30px,1fr))`;
  const q = (d: string) => `/hospitality?from=${d}${focus ? `&lot=${focus}` : ""}`;

  return (
    <section className="panel">
      <h2>
        Calendar
        <span className="weeknav" style={{ margin: 0 }}>
          <Link className="btn sm" href={q(addDays(from, -DAYS))} aria-label="Previous four weeks">←</Link>
          <Link className="btn sm" href={q(today)}>Today</Link>
          <Link className="btn sm" href={q(addDays(from, DAYS))} aria-label="Next four weeks">→</Link>
        </span>
      </h2>
      <p className="muted" style={{ fontSize: 13, margin: "-4px 0 10px" }}>
        {fmtDate(from, { month: "long", day: "numeric" })} to {fmtDate(addDays(to, -1), { month: "long", day: "numeric", year: "numeric" })}.
        Click a free night to book it, or a stay to open it.
      </p>
      <div className="tl-wrap">
        <div className="tl" style={{ gridTemplateColumns: cols }}>
          <div className="tl-corner" />
          {days.map((d) => (
            <div key={d} className={`tl-day ${d === today ? "today" : ""} ${[0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay()) ? "we" : ""}`}>
              <span>{DOW[new Date(`${d}T00:00:00Z`).getUTCDay()].slice(0, 2)}</span>
              <b>{Number(d.slice(8))}</b>
            </div>
          ))}
          {homes.map((h) => {
            const mine = stays.filter((s) => s.lot_id === h.id && s.check_in < to && s.check_out > from);
            return (
              <div key={h.id} className={`tl-row ${focus === h.id ? "focus" : ""}`} style={{ gridTemplateColumns: cols }}>
                <Link href={`/estate/${h.id}`} className="tl-home">
                  <b>{lotTitle(h)}</b>
                  <span>{h.in_hospitality ? (h.nightly_rate ? money(h.nightly_rate, h.rate_currency) : "Listed") : "Not listed"}</span>
                </Link>
                {days.map((d, i) => (
                  <button
                    key={d}
                    type="button"
                    className={`tl-cell ${d === today ? "today" : ""} ${d < today ? "past" : ""}`}
                    style={{ gridColumn: i + 2, gridRow: 1 }}
                    disabled={d < today || !h.in_hospitality}
                    aria-label={`Book ${lotTitle(h)} from ${fmtDate(d)}`}
                    onClick={() => onEmpty(h.id, d)}
                  />
                ))}
                {mine.map((s) => {
                  const a = Math.max(0, nights(from, s.check_in));
                  const b = Math.min(DAYS, nights(from, s.check_out));
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={`tl-stay ${s.kind} ${s.status}`}
                      style={{ gridColumn: `${a + 2} / ${b + 2}`, gridRow: 1 }}
                      title={`${s.guest_name}, ${fmtDate(s.check_in)} – ${fmtDate(s.check_out)}`}
                      onClick={() => onStay(s)}
                    >
                      {s.kind === "guest" ? s.guest_name : label(STAY_KINDS, s.kind)}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <div className="tl-legend">
        <span><i className="guest" /> Guest stay</span>
        <span><i className="inquiry" /> Inquiry</span>
        <span><i className="owner" /> Owner</span>
        <span><i className="hold" /> Blocked</span>
      </div>
    </section>
  );
}
