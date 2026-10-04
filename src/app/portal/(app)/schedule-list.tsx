"use client";

import Link from "next/link";
import { useState } from "react";
import { coverUrl } from "@/lib/covers";
import { dayLabel, fmtTime } from "@/lib/dates";
import { kindName, priceLabel, type Session, type TicketType } from "@/lib/schedule";

export function ScheduleList({
  today,
  sessions,
  tickets,
  facilitators,
}: {
  today: string;
  sessions: Session[];
  tickets: TicketType[];
  facilitators: { id: string; name: string }[];
}) {
  const [kind, setKind] = useState("");
  const list = sessions.filter((s) => !kind || s.o.kind === kind);
  const dates = [...new Set(list.map((s) => s.date))];
  return (
    <>
      <div className="pills" role="group" aria-label="Show">
        {[
          ["", "Everything"],
          ["class", "Classes"],
          ["event", "Events"],
        ].map(([k, l]) => (
          <button key={k} type="button" className="pill" aria-pressed={kind === k} onClick={() => setKind(k)}>
            {l}
          </button>
        ))}
      </div>
      {!list.length ? (
        <div className="empty">
          <h2>Nothing on the schedule yet</h2>
          <p>New classes and events show up here as soon as they’re published.</p>
        </div>
      ) : (
        dates.map((d) => (
          <section className={`p-day ${d === today ? "today" : ""}`} key={d}>
            <h3>{dayLabel(d, today)}</h3>
            {list
              .filter((s) => s.date === d)
              .map((s) => {
                const f = facilitators.find((x) => x.id === s.o.facilitator_id);
                const cover = coverUrl(s.o.cover_path);
                return (
                  <Link
                    key={s.o.id}
                    className={`p-card ${s.cancelled ? "cancelled" : ""} ${cover ? "has-img" : ""}`}
                    href={`/e/${s.o.id}/${d}`}
                  >
                    <div className="t">
                      {fmtTime(s.o.start_time)}
                      <small>{s.o.end_time ? `to ${fmtTime(s.o.end_time)}` : ""}</small>
                    </div>
                    <div>
                      <h4>{s.o.title}</h4>
                      <div className="sub">
                        {[f ? `with ${f.name}` : "", s.o.location ?? ""].filter(Boolean).join(", ") ||
                          kindName(s.o.kind)}
                      </div>
                      {s.cancelled && <span className="tag-sm out">Cancelled</span>}
                    </div>
                    <div className="right">{priceLabel(s.o, tickets)}</div>
                    {cover && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="thumb" src={cover} alt="" />
                    )}
                  </Link>
                );
              })}
          </section>
        ))
      )}
    </>
  );
}
