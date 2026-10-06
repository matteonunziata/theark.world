// Date-range presets for the analytics range picker. Kept out of the
// picker's "use client" module so server pages can call them: a server
// component can render a client component but can't run its other exports.

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
