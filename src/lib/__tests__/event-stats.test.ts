import { describe, expect, it } from "vitest";
import { isPending, type StatReg, type StatTicket, summarize } from "@/lib/event-stats";

const ticket = (id: string, name: string, position: number, kind = "main", qty: number | null = null): StatTicket => ({ id, name, kind, qty, position });
const item = (t: string, qty: number, price: number, currency = "CRC") => ({ ticket_type_id: t, qty, unit_price: price, currency });
const reg = (over: Partial<StatReg> & { items?: StatReg["items"] }): StatReg => ({
  status: "confirmed", hold_until: null, paid: true, seats: 1, created_at: "2026-10-01T12:00:00Z", items: [], ...over,
});
const day = (iso: string) => iso.slice(0, 10);
const tickets = [ticket("ga", "General", 0), ticket("lunch", "Lunch", 1, "addon")];
const now = Date.parse("2026-10-10T00:00:00Z");

describe("event stats", () => {
  it("counts confirmed bookings and the tickets in them", () => {
    const s = summarize(
      [
        reg({ seats: 2, items: [item("ga", 2, 10000), item("lunch", 1, 5000)] }),
        reg({ seats: 1, items: [item("ga", 1, 10000)] }),
      ],
      tickets, day, now,
    );
    expect(s.registrations).toBe(2);
    expect(s.ticketsSold).toBe(4);
    expect(s.byType.map((t) => [t.ticket.name, t.sold])).toEqual([["General", 3], ["Lunch", 1]]);
    expect(s.revenue).toEqual({ CRC: 35000 });
  });
  it("keeps unpaid, pending, cancelled and lapsed apart", () => {
    const s = summarize(
      [
        reg({ paid: false, items: [item("ga", 1, 10000)] }),
        reg({ status: "held", paid: false, hold_until: "2026-10-10T00:30:00Z", items: [item("ga", 1, 10000)] }),
        reg({ status: "held", paid: false, hold_until: "2026-10-09T00:30:00Z", items: [item("ga", 1, 10000)] }),
        reg({ status: "cancelled", paid: true, items: [item("ga", 2, 10000)] }),
      ],
      tickets, day, now,
    );
    expect(s.registrations).toBe(1);
    expect(s.pending).toBe(1);
    expect(s.cancelled).toBe(1);
    expect(s.revenue).toEqual({});
    expect(s.owed).toEqual({ CRC: 10000 });
    expect(s.refund).toEqual({ CRC: 20000 });
    expect(isPending({ status: "held", hold_until: "2026-10-09T00:30:00Z" }, now)).toBe(false);
  });
  it("counts seats for bookings with no tickets", () => {
    const s = summarize([reg({ seats: 3, items: [] })], tickets, day, now);
    expect(s.ticketsSold).toBe(3);
    expect(s.included).toBe(3);
  });
  it("keeps currencies apart", () => {
    const s = summarize([reg({ items: [item("ga", 1, 10000), item("lunch", 1, 20, "USD")] })], tickets, day, now);
    expect(s.revenue).toEqual({ CRC: 10000, USD: 20 });
  });
  it("lists every day between the first and last booking", () => {
    const s = summarize(
      [reg({ created_at: "2026-10-01T10:00:00Z", items: [item("ga", 1, 1)] }), reg({ created_at: "2026-10-03T10:00:00Z", items: [item("ga", 2, 1)] })],
      tickets, day, now,
    );
    expect(s.daily).toEqual([
      { day: "2026-10-01", bookings: 1, tickets: 1 },
      { day: "2026-10-02", bookings: 0, tickets: 0 },
      { day: "2026-10-03", bookings: 1, tickets: 2 },
    ]);
  });
});
