import { addDays, addMonths, dow, monthKey } from "@/lib/dates";

export const DATE_FILTERS = [
  ["all", "All"],
  ["today", "Today"],
  ["week", "This week"],
  ["weekend", "This weekend"],
  ["month", "This month"],
  ["next-month", "Next month"],
] as const;
export type DateFilter = (typeof DATE_FILTERS)[number][0];

const lastOfMonth = (key: string) => addDays(`${addMonths(key, 1)}-01`, -1);

/** The first and last day (inclusive, YYYY-MM-DD) a filter covers, as of `today`. null = no limit. */
export function dateRange(filter: DateFilter, today: string): [string, string] | null {
  switch (filter) {
    case "all":
      return null;
    case "today":
      return [today, today];
    case "week":
      // Today to Sunday.
      return [today, addDays(today, (7 - dow(today)) % 7)];
    case "weekend": {
      const d = dow(today);
      // On a Sunday it's the rest of this weekend; on a Saturday, today and tomorrow.
      if (d === 0) return [today, today];
      const sat = addDays(today, d === 6 ? 0 : 6 - d);
      return [sat, addDays(sat, 1)];
    }
    case "month":
      return [today, lastOfMonth(monthKey(today))];
    case "next-month": {
      const next = addMonths(monthKey(today), 1);
      return [`${next}-01`, lastOfMonth(next)];
    }
  }
}

/** The first of an event's dates inside the range, or null when none is. */
export function firstDateIn(dates: string[], filter: DateFilter, today: string): string | null {
  const r = dateRange(filter, today);
  return dates.find((d) => !r || (d >= r[0] && d <= r[1])) ?? null;
}
