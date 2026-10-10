// Active stewardship: status vocabulary and the profit-share clock.
// Months are whole calendar months from active_since; nothing is stored but the date.

export const STEWARD_STATUS = [
  ["active", "Active"],
  ["inactive", "Not active"],
  ["suspended", "Suspended"],
] as const;

export const stewardStatusName = (k: string | null | undefined) =>
  STEWARD_STATUS.find(([key]) => key === k)?.[1] ?? "Not active";

const parts = (iso: string) => iso.slice(0, 10).split("-").map(Number) as [number, number, number];

/** Whole months from `since` to `today` (0 on the first day). */
export function monthsActive(since: string | null | undefined, today: string) {
  if (!since) return 0;
  const [sy, sm, sd] = parts(since);
  const [ty, tm, td] = parts(today);
  return Math.max(0, (ty - sy) * 12 + (tm - sm) - (td < sd ? 1 : 0));
}

/** The day the clock reaches `months` (clamped to the end of a short month). */
export function eligibleOn(since: string, months: number) {
  const [y, m, d] = parts(since);
  const last = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + months, Math.min(d, last))).toISOString().slice(0, 10);
}
