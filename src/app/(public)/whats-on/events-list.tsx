"use client";

import Link from "next/link";
import { useState } from "react";
import { DATE_FILTERS, type DateFilter, firstDateIn } from "@/lib/event-filters";

export type Slot = { date: string; month: string; day: string; year: string; when: string };

export type EventRow = {
  key: string;
  id: string;
  /** Every upcoming date, soonest first. */
  slots: Slot[];
  kind: string;
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
export function EventsList({ events, today }: { events: EventRow[]; today: string }) {
  const kinds = ["All", ...new Set(events.map((e) => e.kind))];
  const [kind, setKind] = useState("All");
  const [when, setWhen] = useState<DateFilter>("all");
  // Each event shows its first date inside the chosen range; events with none drop out.
  const list = (kind === "All" ? events : events.filter((e) => e.kind === kind)).flatMap((e) => {
    const date = firstDateIn(e.slots.map((x) => x.date), when, today);
    const slot = date ? e.slots.find((x) => x.date === date) : null;
    return slot ? [{ ...e, slot }] : [];
  });

  return (
    <>
      <div className="filters" role="group" aria-label="Filter by date">
        {DATE_FILTERS.map(([v, label]) => (
          <button key={v} type="button" className="filter" aria-pressed={v === when} onClick={() => setWhen(v)}>
            {label}
          </button>
        ))}
      </div>
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
          {when !== "all"
            ? "Nothing is planned for these dates. Try another range."
            : (EMPTY[kind] ?? "Nothing is planned just yet.") + " New dates are added often, so please check back."}
        </p>
      ) : (
        <div className="event-grid">
          {list.map((e) => (
            <article className="event-card" key={e.key}>
              <Link
                className="card-img"
                href={`/e/${e.id}/${e.slot.date}`}
                tabIndex={-1}
                aria-hidden="true"
                style={e.cover ? { backgroundImage: `url(${e.cover})` } : undefined}
              >
                <span className="card-date">
                  <span className="m">{e.slot.month}</span>
                  <span className="d">{e.slot.day}</span>
                </span>
              </Link>
              <div className="card-body">
                <div className="event-meta">
                  <span className="tag">{e.kind}</span>
                  <span className="when">{e.slot.when}</span>
                </div>
                <h3>{e.title}</h3>
                {e.desc && <p className="card-desc">{e.desc}</p>}
                {e.repeats && <p className="card-repeats">{e.repeats}</p>}
                <div className="card-foot">
                  <span>{e.price}</span>
                  <Link className="btn btn-primary" href={`/e/${e.id}/${e.slot.date}`}>
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
