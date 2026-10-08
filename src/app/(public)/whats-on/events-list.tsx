"use client";

import Link from "next/link";
import { useState } from "react";

export type EventRow = {
  key: string;
  id: string;
  date: string;
  month: string;
  day: string;
  year: string;
  kind: string;
  when: string;
  title: string;
  desc: string;
  price: string;
  cta: string;
};

/** The upcoming list with its kind filter. */
export function EventsList({ events }: { events: EventRow[] }) {
  const kinds = ["All", ...new Set(events.map((e) => e.kind))];
  const [kind, setKind] = useState("All");
  const list = kind === "All" ? events : events.filter((e) => e.kind === kind);

  return (
    <>
      {kinds.length > 2 && (
        <div className="filters" role="group" aria-label="Filter events">
          {kinds.map((k) => (
            <button key={k} type="button" className="filter" aria-pressed={k === kind} onClick={() => setKind(k)}>
              {k}
            </button>
          ))}
        </div>
      )}
      <div className="event-list">
        {list.length === 0 ? (
          <p className="empty">Nothing here yet. Check back soon.</p>
        ) : (
          list.map((e) => (
            <article className="event" key={e.key}>
              <div className="event-date">
                <span className="m">{e.month}</span>
                <span className="d">{e.day}</span>
                <span className="y">{e.year}</span>
              </div>
              <div className="event-body">
                <div className="event-meta">
                  <span className="tag">{e.kind}</span>
                  <span className="when">{e.when}</span>
                </div>
                <h3>{e.title}</h3>
                {e.desc && <p>{e.desc}</p>}
              </div>
              <div className="event-buy">
                <span>{e.price}</span>
                <Link className="btn btn-primary" href={`/e/${e.id}/${e.date}`}>
                  {e.cta}
                </Link>
              </div>
            </article>
          ))
        )}
      </div>
    </>
  );
}
