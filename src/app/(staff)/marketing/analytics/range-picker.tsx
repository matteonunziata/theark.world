"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { addDays } from "@/lib/dates";

/** Date range for analytics, kept in the URL with the brand filter. */
export function RangePicker({ from, to, today }: { from: string; to: string; today: string }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const set = (f: string, t: string) => {
    const next = new URLSearchParams(params);
    next.set("from", f);
    next.set("to", t);
    router.push(`${path}?${next}`);
  };
  const q = Math.floor((Number(today.slice(5, 7)) - 1) / 3) * 3 + 1;
  const quarter = `${today.slice(0, 4)}-${String(q).padStart(2, "0")}-01`;
  const presets: [string, string, string][] = [
    ["Last 30 days", addDays(today, -29), today],
    ["Last 90 days", addDays(today, -89), today],
    ["This quarter", quarter, today],
  ];
  return (
    <div className="range-pick">
      <div className="pill-row" role="group" aria-label="Range" style={{ margin: 0 }}>
        {presets.map(([n, f, t]) => (
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
