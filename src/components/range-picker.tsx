"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type Preset, quarterPresets } from "@/lib/range-presets";

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
