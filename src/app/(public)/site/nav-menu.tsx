"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type NavGroup = { label: string; items: readonly (readonly [string, string])[]; note: string };

/** Grouped main menu: one dropdown per group, opened on click or hover, closed on outside click or Escape. */
export function NavMenu({ groups, here }: { groups: readonly NavGroup[]; here: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const away = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, []);

  return (
    <div className="nav-links" ref={ref}>
      {groups.map((g) => {
        const on = open === g.label;
        return (
          <div
            key={g.label}
            className={`nav-group${on ? " open" : ""}`}
            onPointerEnter={(e) => e.pointerType === "mouse" && setOpen(g.label)}
            onPointerLeave={(e) => e.pointerType === "mouse" && setOpen(null)}
          >
            <button
              type="button"
              className="nav-trigger"
              aria-expanded={on}
              aria-current={g.items.some(([, href]) => href === here) ? "page" : undefined}
              onClick={() => setOpen(on ? null : g.label)}
            >
              {g.label}
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                <path d={on ? "M2 6.5 5 3.5l3 3" : "M2 3.5 5 6.5l3-3"} fill="none" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            </button>
            {on && (
              <div className="nav-panel">
                {g.items.map(([name, href]) => (
                  <Link key={name} href={href} onClick={() => setOpen(null)}>
                    {name}
                  </Link>
                ))}
                <p>{g.note}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
