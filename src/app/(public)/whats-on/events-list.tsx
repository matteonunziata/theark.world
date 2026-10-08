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
  cover: string | null;
  repeats: string;
};

const PLURAL: Record<string, string> = {
  Event: "Events",
  Experience: "Experiences",
  Expedition: "Expeditions",
};

const EMPTY: Record<string, string> = {
  Event: "No events are planned just yet.",
  Experience: "No experiences are open just yet.",
  Expedition: "No expeditions are planned just yet.",
};

/** The upcoming cards with their kind filter. */
export function EventsList({ events }: { events: EventRow[] }) {
  const kinds = ["All", ...new Set(events.map((e) => e.kind))];
  const [kind, setKind] = useState("All");
  const list = kind === "All" ? events : events.filter((e) => e.kind === kind);

  return (
    <>
      {kinds.length > 2 && (
        <div className="filters" role="group" aria-label="Filter by type">
          {kinds.map((k) => (
            <button key={k} type="button" className="filter" aria-pressed={k === kind} onClick={() => setKind(k)}>
              {PLURAL[k] ?? k}
            </button>
          ))}
        </div>
      )}
      {list.length === 0 ? (
        <p className="empty">
          {EMPTY[kind] ?? "Nothing is planned just yet."} New dates are added often, so please check back.
        </p>
      ) : (
        <div className="event-grid">
          {list.map((e) => (
            <article className="event-card" key={e.key}>
              <Link
                className="card-img"
                href={`/e/${e.id}/${e.date}`}
                tabIndex={-1}
                aria-hidden="true"
                style={e.cover ? { backgroundImage: `url(${e.cover})` } : undefined}
              >
                <span className="card-date">
                  <span className="m">{e.month}</span>
                  <span className="d">{e.day}</span>
                </span>
              </Link>
              <div className="card-body">
                <div className="event-meta">
                  <span className="tag">{e.kind}</span>
                  <span className="when">{e.when}</span>
                </div>
                <h3>{e.title}</h3>
                {e.desc && <p className="card-desc">{e.desc}</p>}
                {e.repeats && <p className="card-repeats">{e.repeats}</p>}
                <div className="card-foot">
                  <span>{e.price}</span>
                  <Link className="btn btn-primary" href={`/e/${e.id}/${e.date}`}>
                    {e.cta}
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
