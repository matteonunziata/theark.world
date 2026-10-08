import type { Tables } from "@/lib/database.types";
import { addDays, DOW, DOW_LONG, dow, fmtDate, timeRange } from "@/lib/dates";

export type Offering = Tables<"offerings">;
export type TicketType = Tables<"ticket_types">;

const ORDINAL = ["1st", "2nd", "3rd", "4th", "5th"];
const nth = (n: number) => `${n}${["th", "st", "nd", "rd"][(n % 100 > 10 && n % 100 < 14) || n % 10 > 3 ? 0 : n % 10]}`;
const weekIndex = (d: string) => Math.floor((Number(d.slice(8, 10)) - 1) / 7);
const monthNo = (d: string) => Number(d.slice(0, 4)) * 12 + Number(d.slice(5, 7));
const mondayOf = (d: string) => addDays(d, -((dow(d) + 6) % 7));

/** Dates an offering runs between from and to (inclusive). Mirrors public.occurs_on. */
export function occurrences(o: Offering, from: string, to: string) {
  const out: string[] = [];
  if (o.repeat === "dates") {
    return [...o.custom_dates].filter((d) => d >= from && d <= to).sort();
  }
  if (o.repeat !== "weekly" && o.repeat !== "monthly") {
    if (o.start_date >= from && o.start_date <= to) out.push(o.start_date);
    return out;
  }
  const days = o.days.map(Number);
  if (o.repeat === "weekly" && !days.length) return out;
  const every = o.repeat_every || 1;
  const startWeek = mondayOf(o.start_date);
  let d = o.start_date > from ? o.start_date : from;
  const end = o.end_date && o.end_date < to ? o.end_date : to;
  let guard = 0;
  while (d <= end && guard++ < 1500) {
    if (o.repeat === "weekly") {
      const weeks = Math.round((Date.parse(mondayOf(d)) - Date.parse(startWeek)) / 604800000);
      if (days.includes(dow(d)) && weeks % every === 0) out.push(d);
    } else if ((monthNo(d) - monthNo(o.start_date)) % every === 0) {
      const same =
        o.month_mode === "weekday"
          ? dow(d) === dow(o.start_date) && weekIndex(d) === weekIndex(o.start_date)
          : d.slice(8, 10) === o.start_date.slice(8, 10);
      if (same) out.push(d);
    }
    d = addDays(d, 1);
  }
  return out;
}

export type Session = { o: Offering; date: string; cancelled: boolean };

export function sessions(
  offerings: Offering[],
  cancellations: { offering_id: string; session_date: string }[],
  from: string,
  to: string,
  { published = false, kind = "" } = {},
): Session[] {
  const skip = new Set(
    cancellations.map((c) => `${c.offering_id}|${c.session_date}`),
  );
  const list: Session[] = [];
  for (const o of offerings) {
    if (published && o.status !== "published") continue;
    if (kind && o.kind !== kind) continue;
    for (const date of occurrences(o, from, to)) {
      list.push({ o, date, cancelled: skip.has(`${o.id}|${date}`) });
    }
  }
  return list.sort((a, b) =>
    (a.date + (a.o.start_time ?? "")).localeCompare(
      b.date + (b.o.start_time ?? ""),
    ),
  );
}

export function money(price: number | null | undefined, cur?: string | null) {
  const n = Number(price || 0);
  if (!n) return "Free";
  return cur === "USD"
    ? `$${n.toLocaleString("en-US")}`
    : `₡${n.toLocaleString("en-US")}`;
}

export const KINDS = [
  ["class", "Class"],
  ["event", "Event"],
  ["experience", "Experience"],
  ["expedition", "Expedition"],
] as const;

export type Kind = (typeof KINDS)[number][0];

export const kindName = (k: string) => KINDS.find(([x]) => x === k)?.[1] ?? "Class";

export function whenLabel(o: Offering) {
  if (o.repeat === "dates") {
    const ds = [...o.custom_dates].sort();
    const shown = ds.slice(0, 3).map((d) => fmtDate(d, { month: "short", day: "numeric" })).join(", ");
    return `${shown}${ds.length > 3 ? ` +${ds.length - 3} more` : ""}, ${timeRange(o)}`;
  }
  if (o.repeat === "monthly") {
    const every = o.repeat_every > 1 ? `Every ${o.repeat_every} months` : "Monthly";
    const on =
      o.month_mode === "weekday"
        ? `${ORDINAL[weekIndex(o.start_date)]} ${DOW_LONG[dow(o.start_date)]}`
        : `the ${nth(Number(o.start_date.slice(8, 10)))}`;
    return `${every} on ${on}, ${timeRange(o)}${o.end_date ? ` until ${fmtDate(o.end_date, { month: "short", day: "numeric" })}` : ""}`;
  }
  if (o.repeat === "weekly") {
    const days = [...o.days]
      .map(Number)
      .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
    const d =
      days.length === 7
        ? "Every day"
        : days.length === 1
          ? DOW_LONG[days[0]]
          : days.map((x) => DOW[x]).join(", ");
    return (
      `${o.repeat_every > 1 ? `Every ${o.repeat_every} weeks: ` : ""}${d}, ${timeRange(o)}` +
      (o.end_date
        ? ` until ${fmtDate(o.end_date, { month: "short", day: "numeric" })}`
        : "")
    );
  }
  if (o.end_date && o.end_date > o.start_date) {
    return `${fmtDate(o.start_date, { month: "short", day: "numeric" })} – ${fmtDate(o.end_date, { month: "short", day: "numeric" })}`;
  }
  return `${fmtDate(o.start_date)}, ${timeRange(o)}`;
}

/** Classes are included for members; events may charge everyone. */
export function priceLabel(o: Offering, tickets: TicketType[]) {
  const t = tickets.filter((x) => x.offering_id === o.id);
  if (!t.length) return o.access === "members" ? "Included for members" : "Free";
  const min = t.reduce((a, b) => (Number(b.price) < Number(a.price) ? b : a));
  // Meals: everyone pays when they book, members too.
  if (t.every((x) => x.pay_first)) return Number(min.price) ? money(min.price, min.currency) : "Paid when you book";
  if (o.access === "members") return "Included for members";
  return t.length > 1 && Number(min.price)
    ? `From ${money(min.price, min.currency)}`
    : money(min.price, min.currency);
}
