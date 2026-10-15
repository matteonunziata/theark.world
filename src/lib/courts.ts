import type { Offering } from "@/lib/schedule";

export type Court = {
  id: string;
  name: string;
  sport: string;
  open_time: string;
  close_time: string;
  slot_minutes: number;
};

/** A court as the public page sees it: with its price per slot. */
export type PublicCourt = Court & {
  price: number | null;
  price_90: number | null;
  price_180: number | null;
  currency: string;
  description: string | null;
  max_players: number;
};

export const SPORTS = [
  ["padel", "Padel"],
  ["pickleball", "Pickleball"],
] as const;

export const sportName = (k: string) => SPORTS.find(([x]) => x === k)?.[1] ?? k;

export const BOOKING_DAYS = 14;
export const PER_DAY = 2;
/** Minutes a slot is held while someone pays. Mirrors hold_court(). */
export const HOLD_MINUTES = 20;
/** The lengths a court can be booked for, in minutes. The prices live in court_prices. */
export const LENGTHS = [60, 90, 180] as const;
/** A match is doubles (4) or singles (2). */
export const MATCH_SIZES = [4, 2] as const;
/** The refund and cancel window for the person who booked, in hours. */
export const CANCEL_HOURS = 24;
/** Bookings can be moved up to this many hours before the start, and this many times. */
export const MOVE_HOURS = 3;
export const MOVE_LIMIT = 2;

/** A line of the price list (equipment, as the public page needs it). */
export type PriceItem = { key: string; kind: string; label: string; minutes: number | null; price: number };
/** What someone adds to a booking: an equipment key and how many. */
export type EquipmentPick = { key: string; qty: number };

/** The money for a list of equipment picks. */
export const equipmentTotal = (items: PriceItem[], picks: EquipmentPick[]) =>
  picks.reduce((sum, p) => sum + (items.find((i) => i.key === p.key)?.price ?? 0) * p.qty, 0);

/**
 * Self-assessed playing level, on Playtomic's 0–7 scale so people can carry
 * their number over. Stored as the middle of the band.
 */
export const LEVELS = [
  [0.5, "New to the game", "First times on court"],
  [1.5, "Beginner", "Knows the rules, rallies a bit"],
  [2.5, "Improver", "Plays regularly, building consistency"],
  [3.5, "Intermediate", "Reliable rallies, some tactics"],
  [4.5, "Advanced", "Competitive club player"],
  [5.5, "Expert", "Tournament level"],
] as const;

export const levelName = (n: number | null | undefined) => {
  if (n === null || n === undefined) return "";
  const found = LEVELS.find(([v]) => Math.abs(v - Number(n)) < 0.5);
  return found ? found[1] : `Level ${n}`;
};

/** "2.5–4.5" for a match's level range. */
export const levelRange = (min: number | null | undefined, max: number | null | undefined) =>
  min === null || min === undefined || max === null || max === undefined ? "" : `${Number(min)}–${Number(max)}`;

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};
const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** The bookable slots of a court, as "HH:MM" start and end. */
export function slots(c: Pick<Court, "open_time" | "close_time" | "slot_minutes">) {
  const out: { start: string; end: string }[] = [];
  const close = toMin(c.close_time);
  for (let t = toMin(c.open_time); t + c.slot_minutes <= close; t += c.slot_minutes) {
    out.push({ start: toTime(t), end: toTime(t + c.slot_minutes) });
  }
  return out;
}

/** The lengths a booking can have: 1, 1½ or 3 hours. */
export const durations = (): number[] => [...LENGTHS];

/** "1 hour", "1½ hours", "2 hours", "45 min". */
export const durationLabel = (minutes: number) => {
  if (minutes % 60 === 0) return `${minutes / 60} hour${minutes === 60 ? "" : "s"}`;
  if (minutes === 90) return "1½ hours";
  return `${minutes} min`;
};

/** "HH:MM" plus minutes. */
export const addMinutes = (t: string, minutes: number) => toTime(toMin(t) + minutes);

/** Do two "HH:MM" ranges overlap? */
export const overlapsTime = (a: { start: string; end: string }, b: { start: string; end: string }) =>
  toMin(a.start) < toMin(b.end) && toMin(b.start) < toMin(a.end);

/**
 * A class at the courts that covers this slot, if any. Same rule as the
 * database (court_class_at): "padel" or "pickleball" in the title blocks
 * that sport's courts; any other class at the courts blocks them all.
 */
export function classAt(
  court: Pick<Court, "sport">,
  slot: { start: string; end: string },
  classes: Pick<Offering, "title" | "location" | "start_time" | "end_time">[],
) {
  return (
    classes.find((o) => {
      if (!o.location?.toLowerCase().includes("court") || !o.start_time || !o.end_time) return false;
      if (!overlapsTime(slot, { start: o.start_time.slice(0, 5), end: o.end_time.slice(0, 5) })) return false;
      const t = o.title.toLowerCase();
      if (t.includes("padel")) return court.sport === "padel";
      if (t.includes("pickleball")) return court.sport === "pickleball";
      return true;
    })?.title ?? null
  );
}

export const hhmm = (t: string) => t.slice(0, 5);

/** What a booking of this length costs (before any member discount), from the court's price list. */
export function courtPrice(
  c: Pick<PublicCourt, "price" | "price_90" | "price_180">,
  minutes: number,
) {
  const n = minutes === 60 ? c.price : minutes === 90 ? c.price_90 : minutes === 180 ? c.price_180 : null;
  return Math.round(Number(n ?? 0));
}

/** Each player's share of a court, split evenly. */
export const share = (amount: number, spots: number, currency: string) =>
  currency === "USD" ? Math.round((amount / spots) * 100) / 100 : Math.round(amount / spots);

/** ₡20,000 or $40. */
export const courtMoney = (amount: number | null | undefined, currency: string) => {
  const n = Number(amount ?? 0);
  if (!n) return "Free";
  return currency === "USD"
    ? `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
    : `₡${Math.round(n).toLocaleString("en-US")}`;
};
