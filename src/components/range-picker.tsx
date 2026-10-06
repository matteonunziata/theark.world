"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { addDays } from "@/lib/dates";

export type Preset = [label: string, from: string, to: string];

/** The marketing presets: a month, a quarter, the calendar quarter so far. */
export function quarterPresets(today: string): Preset[] {
  const q = Math.floor((Number(today.slice(5, 7)) - 1) / 3) * 3 + 1;
  const quarter = `${today.slice(0, 4)}-${String(q).padStart(2, "0")}-01`;
  return [
    ["Last 30 days", addDays(today, -29), today],
    ["Last 90 days", addDays(today, -89), today],
    ["This quarter", quarter, today],
  ];
}

/** The shop presets: this week, a month, a quarter. */
export function recentPresets(today: string): Preset[] {
  return [
    ["Last 7 days", addDays(today, -6), today],
    ["Last 30 days", addDays(today, -29), today],
    ["Last 90 days", addDays(today, -89), today],
  ];
}

/** Date range for analytics, kept in the URL alongside any other filters. */
export function RangePicker({
  from,
  to,
  today,
  presets,
}: {
  from: string;
  to: string;
  today: string;
  presets?: Preset[];
}) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const set = (f: string, t: string) => {
    const next = new URLSearchParams(params);
    next.set("from", f);
    next.set("to", t);
    router.push(`${path}?${next}`);
  };
  const list = presets ?? quarterPresets(today);
  return (
    <div className="range-pick">
      <div className="pill-row" role="group" aria-label="Range" style={{ margin: 0 }}>
        {list.map(([n, f, t]) => (
          <button key={n} type="button" className="pill" aria-pressed={from === f && to === t} onClick={() => set(f, t)}>
            {n}
          </button>
        ))}
      </div>
      <label>
        From <input type="date" value={from} max={to} onChange={(e) => e.target.value && set(e.target.value, to)} />
      </label>
      <label>
        to <input type="date" value={to} min={from} onChange={(e) => e.target.value && set(from, e.target.value)} />
      </label>
    </div>
  );
}
