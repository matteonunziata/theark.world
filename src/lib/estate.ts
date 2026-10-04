import { addDays } from "@/lib/dates";

export const LOT_STATUS = [
  ["available", "Available"],
  ["reserved", "Reserved"],
  ["sold", "Sold"],
  ["not_for_sale", "Not for sale"],
] as const;

export const HOME_STATUS = [
  ["none", "No home yet"],
  ["planned", "Planned"],
  ["building", "Being built"],
  ["built", "Built"],
] as const;

export const RELATIONS = [
  ["owner", "Owner"],
  ["partner", "Partner"],
  ["child", "Child"],
  ["family", "Family"],
  ["resident", "Resident"],
  ["staff", "Household staff"],
  ["other", "Other"],
] as const;

export const MAINT_CATEGORIES = [
  ["repair", "Repair"],
  ["garden", "Garden"],
  ["pool", "Pool"],
  ["cleaning", "Cleaning"],
  ["inspection", "Inspection"],
  ["build", "Construction"],
  ["other", "Other"],
] as const;

export const MAINT_STATUS = [
  ["open", "Open"],
  ["scheduled", "Scheduled"],
  ["done", "Done"],
] as const;

export const STAY_KINDS = [
  ["guest", "Guest stay"],
  ["owner", "Owner using the home"],
  ["hold", "Blocked"],
] as const;

export const STAY_STATUS = [
  ["inquiry", "Inquiry"],
  ["confirmed", "Confirmed"],
  ["cancelled", "Cancelled"],
] as const;

export const STAY_SOURCES = [
  ["direct", "Direct"],
  ["airbnb", "Airbnb"],
  ["booking", "Booking.com"],
  ["owner", "Owner"],
  ["other", "Other"],
] as const;

export const label = (list: readonly (readonly [string, string])[], k: string | null | undefined) =>
  list.find(([key]) => key === k)?.[1] ?? "—";

export const statusTone: Record<string, string> = {
  available: "var(--leaf)",
  reserved: "var(--sun)",
  sold: "var(--slate)",
  not_for_sale: "var(--plum)",
};

export const estatePhoto = (path: string | null | undefined) =>
  path
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/estate/${path}`
    : null;

export const lotTitle = (l: { code: string; name: string | null }) =>
  l.name ? `${l.name}` : `Lot ${l.code}`;

export function area(m2: number | string | null | undefined) {
  if (m2 === null || m2 === undefined || m2 === "") return null;
  const n = Number(m2);
  if (n >= 10000) return `${(n / 10000).toLocaleString("en-US", { maximumFractionDigits: 2 })} ha`;
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 0 })} m²`;
}

/** Nights between two ISO dates (check-out day not counted). */
export function nights(checkIn: string, checkOut: string) {
  return Math.round((Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / 864e5);
}

type Span = { check_in: string; check_out: string };

/** Does the night of `date` fall inside the stay? (Check-out morning is free.) */
export const coversNight = (s: Span, date: string) => s.check_in <= date && date < s.check_out;

/** Two stays overlap when they share a night. */
export const overlaps = (a: Span, b: Span) => a.check_in < b.check_out && b.check_in < a.check_out;

/** First day of the month containing `date`, and the 6×7 grid of days for it (weeks start Monday). */
export function monthGrid(date: string) {
  const first = `${date.slice(0, 7)}-01`;
  const dow = new Date(`${first}T00:00:00Z`).getUTCDay(); // 0 Sun
  const start = addDays(first, -((dow + 6) % 7));
  return { first, days: Array.from({ length: 42 }, (_, i) => addDays(start, i)) };
}

/** Occupancy of a set of homes over [from, to): booked nights / available nights. */
export function occupancy(stays: (Span & { status: string; kind: string })[], homes: number, from: string, to: string) {
  const total = homes * nights(from, to);
  if (!total) return 0;
  let booked = 0;
  for (const s of stays) {
    if (s.status !== "confirmed" || s.kind !== "guest") continue;
    const a = s.check_in > from ? s.check_in : from;
    const b = s.check_out < to ? s.check_out : to;
    if (b > a) booked += nights(a, b);
  }
  return booked / total;
}

export const AMENITIES = [
  "Pool",
  "Ocean view",
  "Air conditioning",
  "Wifi",
  "Workspace",
  "Kitchen",
  "Washer",
  "Parking",
  "Garden",
  "Outdoor shower",
  "BBQ",
  "Solar power",
  "Family friendly",
  "Pets allowed",
  "Club access",
  "Breakfast from the farm",
];

/** "15:00:00" → "3pm" */
export const hourLabel = (t: string | null | undefined) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "pm" : "am";
  const hh = ((h + 11) % 12) + 1;
  return m ? `${hh}:${String(m).padStart(2, "0")}${ap}` : `${hh}${ap}`;
};
