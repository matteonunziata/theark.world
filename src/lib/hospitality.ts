// Hospitality: the cleaning week and the kitchen's stock levels.

/** Cleaning days are stored 0 = Monday … 6 = Sunday. */
export const CLEAN_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** A date's cleaning-day index (0 = Monday), from YYYY-MM-DD. */
export const cleanDayOf = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
};

export const STOCK_CATEGORIES = [
  "Produce",
  "Dairy and eggs",
  "Meat and fish",
  "Dry goods",
  "Drinks",
  "Coffee and tea",
  "Cleaning and supplies",
  "Other",
] as const;

export type StockLevel = "out" | "low" | "ok";

type Stock = { on_hand: number; reorder_at: number };

/** Out at zero, low at or below the reorder point. */
export const stockLevel = (i: Stock): StockLevel =>
  Number(i.on_hand) <= 0 ? "out" : Number(i.on_hand) <= Number(i.reorder_at) ? "low" : "ok";

/** How much to order to get back up to target (at least to just above the reorder point). */
export const orderQty = (i: Stock & { target: number }) => {
  const want = Number(i.target) > 0 ? Number(i.target) : Number(i.reorder_at) * 2;
  return Math.max(0, Math.round((want - Number(i.on_hand)) * 100) / 100);
};

/** 1, 2.5, 0.25 — no trailing zeros. */
export const qty = (n: number | string) => String(Number(Number(n).toFixed(2)));

// Schedule view -------------------------------------------------------------

/** "07:30:00" → minutes since midnight. */
export const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};

/** "07:30:00" → "7:30". */
export const clock = (t: string) => {
  const [h, m] = t.split(":");
  return `${Number(h)}:${m}`;
};

export const endClock = (start: string, hours: number) => {
  const e = toMinutes(start) + Math.round(Number(hours) * 60);
  return `${Math.floor(e / 60)}:${String(e % 60).padStart(2, "0")}`;
};

type Costed = { days: number[]; hours: number | null };

/** Hours a task takes in a week (length × days it runs). */
export const weekHours = (t: Costed) => (t.hours ? Number(t.hours) * t.days.length : 0);

export const hoursLabel = (h: number) => `${qty(h)} h`;
