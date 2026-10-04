import type { Tables } from "@/lib/database.types";
import { addDays, DOW, DOW_LONG, dow, fmtDate, timeRange } from "@/lib/dates";

export type Offering = Tables<"offerings">;
export type TicketType = Tables<"ticket_types">;

/** Dates an offering runs between from and to (inclusive). */
export function occurrences(o: Offering, from: string, to: string) {
  const out: string[] = [];
  if (o.repeat !== "weekly") {
    if (o.start_date >= from && o.start_date <= to) out.push(o.start_date);
    return out;
  }
  const days = o.days.map(Number);
  if (!days.length) return out;
  let d = o.start_date > from ? o.start_date : from;
  const end = o.end_date && o.end_date < to ? o.end_date : to;
  let guard = 0;
  while (d <= end && guard++ < 800) {
    if (days.includes(dow(d))) out.push(d);
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

export const kindName = (k: string) => (k === "event" ? "Event" : "Class");

export function whenLabel(o: Offering) {
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
      `${d}, ${timeRange(o)}` +
      (o.end_date
        ? ` until ${fmtDate(o.end_date, { month: "short", day: "numeric" })}`
        : "")
    );
  }
  return `${fmtDate(o.start_date)}, ${timeRange(o)}`;
}

/** Classes are included for members; events may charge everyone. */
export function priceLabel(o: Offering, tickets: TicketType[]) {
  const t = tickets.filter((x) => x.offering_id === o.id);
  if (!t.length) return o.access === "members" ? "Included for members" : "Free";
  const min = t.reduce((a, b) => (Number(b.price) < Number(a.price) ? b : a));
  if (o.access === "members") return "Included for members";
  return t.length > 1 && Number(min.price)
    ? `From ${money(min.price, min.currency)}`
    : money(min.price, min.currency);
}
