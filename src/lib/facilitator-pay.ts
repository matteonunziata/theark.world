/** How a facilitator is paid for a class. Amounts are in colones. */
export const PAY_TIERS = [
  [1, "Free", "No pay"],
  [2, "Fixed rate", "₡20,000 per class"],
  [3, "Flex", "By people checked in"],
] as const;

export const FIXED_RATE = 20000;

/** Flex bands: pay by the number of people checked in. */
export const FLEX_BANDS = [
  { upTo: 10, pay: 20000, label: "0–10" },
  { upTo: 20, pay: 25000, label: "11–20" },
  { upTo: 30, pay: 30000, label: "21–30" },
  { upTo: Infinity, pay: 35000, label: "31+" },
] as const;

export const tierName = (t: number) => PAY_TIERS.find(([n]) => n === t)?.[1] ?? "Free";

export function facilitatorPay(tier: number, checkedIn: number) {
  if (tier === 2) return FIXED_RATE;
  if (tier === 3) return (FLEX_BANDS.find((b) => checkedIn <= b.upTo) ?? FLEX_BANDS[3]).pay;
  return 0;
}

/** Cutoff is stored in minutes; the form shows it in minutes or hours. */
export function cutoffLabel(min: number | null | undefined) {
  if (min == null) return "No cutoff";
  if (min === 0) return "Closes at start";
  if (min % 60 === 0) return `${min / 60} ${min === 60 ? "hour" : "hours"} before`;
  return `${min} minutes before`;
}

/** Local start of a session as "YYYY-MM-DDTHH:MM". */
export function bookingClosed(
  o: { start_time: string | null; booking_cutoff_minutes: number | null },
  date: string,
  nowLocal: string,
) {
  if (o.booking_cutoff_minutes == null || !o.start_time) return false;
  const start = new Date(`${date}T${o.start_time.slice(0, 5)}:00Z`).getTime();
  const now = new Date(`${nowLocal}:00Z`).getTime();
  return start - o.booking_cutoff_minutes * 60000 <= now;
}
