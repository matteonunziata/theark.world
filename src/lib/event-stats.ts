import { addDays } from "@/lib/dates";

export type StatTicket = { id: string; name: string; kind: string; qty: number | null; position: number };
export type StatItem = { ticket_type_id: string | null; qty: number; unit_price: number; currency: string };
export type StatReg = {
  status: string;
  hold_until: string | null;
  paid: boolean;
  seats: number;
  created_at: string;
  items: StatItem[];
};

/** A booking that counts as pending payment: held, and the hold hasn't lapsed. */
export const isPending = (r: Pick<StatReg, "status" | "hold_until">, now = Date.now()) =>
  r.status === "held" && (!r.hold_until || new Date(r.hold_until).getTime() > now);

/** A lapsed hold is a booking that never happened. */
export const isLapsed = (r: Pick<StatReg, "status" | "hold_until">, now = Date.now()) =>
  r.status === "held" && !!r.hold_until && new Date(r.hold_until).getTime() <= now;

const lineTotal = (i: StatItem) => i.unit_price * i.qty;

/** Money per currency; mixing currencies in one number would be wrong. */
const addMoney = (m: Record<string, number>, currency: string, n: number) => {
  m[currency] = (m[currency] ?? 0) + n;
};

/**
 * The numbers for one event's registration screen.
 * Registrations and tickets count confirmed bookings; pending payment, cancelled and
 * lapsed holds are shown apart. Revenue is what's been paid on confirmed bookings;
 * a paid booking that was cancelled is listed as owing a refund.
 */
export function summarize(regs: StatReg[], tickets: StatTicket[], tz: (iso: string) => string, now = Date.now()) {
  const confirmed = regs.filter((r) => r.status === "confirmed");
  const pending = regs.filter((r) => isPending(r, now));
  const cancelled = regs.filter((r) => r.status === "cancelled");

  const revenue: Record<string, number> = {};
  const owed: Record<string, number> = {};
  const refund: Record<string, number> = {};
  for (const r of confirmed) for (const i of r.items) addMoney(r.paid ? revenue : owed, i.currency, lineTotal(i));
  for (const r of cancelled) if (r.paid) for (const i of r.items) addMoney(refund, i.currency, lineTotal(i));

  // Bookings with no tickets (members, comps) still hold a seat.
  const included = confirmed.filter((r) => r.items.length === 0).reduce((n, r) => n + r.seats, 0);
  const byType = tickets
    .map((t) => {
      const lines = confirmed.flatMap((r) => r.items.filter((i) => i.ticket_type_id === t.id).map((i) => ({ i, paid: r.paid })));
      const rev: Record<string, number> = {};
      for (const l of lines) if (l.paid) addMoney(rev, l.i.currency, lineTotal(l.i));
      return { ticket: t, sold: lines.reduce((n, l) => n + l.i.qty, 0), revenue: rev };
    })
    .sort((a, b) => a.ticket.position - b.ticket.position);
  const ticketsSold = byType.reduce((n, t) => n + t.sold, 0) + included;

  // Bookings per day (venue time), with the quiet days in between so the chart reads as time.
  const perDay = new Map<string, { bookings: number; tickets: number }>();
  for (const r of confirmed) {
    const day = tz(r.created_at);
    const c = perDay.get(day) ?? { bookings: 0, tickets: 0 };
    c.bookings++;
    c.tickets += r.items.length ? r.items.reduce((n, i) => n + i.qty, 0) : r.seats;
    perDay.set(day, c);
  }
  const days = [...perDay.keys()].sort();
  const daily: { day: string; bookings: number; tickets: number }[] = [];
  if (days.length) {
    for (let d = days[0], n = 0; d <= days[days.length - 1] && n < 120; d = addDays(d, 1), n++) {
      daily.push({ day: d, ...(perDay.get(d) ?? { bookings: 0, tickets: 0 }) });
    }
  }

  return {
    registrations: confirmed.length,
    pending: pending.length,
    cancelled: cancelled.length,
    ticketsSold,
    included,
    revenue,
    owed,
    refund,
    byType,
    daily,
  };
}
