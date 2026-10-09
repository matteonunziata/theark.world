import { describe, expect, it } from "vitest";
import { addDays, dayLabel, weekStart } from "@/lib/dates";
import { occurrences, priceLabel, sessions, type Offering, type TicketType } from "@/lib/schedule";
import { nextStep, stepDue } from "@/lib/sequences";

const base: Offering = {
  id: "o1",
  kind: "class",
  title: "Vinyasa",
  description: null,
  facilitator_id: null,
  location: null,
  repeat: "weekly",
  start_date: "2026-10-01",
  end_date: null,
  days: [1, 3],
  start_time: "07:00",
  end_time: "08:00",
  capacity: null,
  booking_cutoff_minutes: null,
  booking_closes_at: null,
  slug: null,
  short_description: null,
  custom_dates: [],
  month_mode: "date",
  repeat_every: 1,
  facilitator_pay_tier: 1,
  city_id: null,
  access: "members",
  status: "published",
  cover_path: null,
  created_by: null,
  created_at: "",
  updated_at: "",
};

describe("schedule", () => {
  it("lists weekly sessions on the chosen days only", () => {
    expect(occurrences(base, "2026-10-01", "2026-10-14")).toEqual([
      "2026-10-05",
      "2026-10-07",
      "2026-10-12",
      "2026-10-14",
    ]);
  });

  it("stops at the end date", () => {
    expect(occurrences({ ...base, end_date: "2026-10-06" }, "2026-10-01", "2026-10-31")).toEqual([
      "2026-10-05",
    ]);
  });

  it("one-off events occur once", () => {
    const e = { ...base, repeat: "none", start_date: "2026-10-10", days: [6] };
    expect(occurrences(e, "2026-10-01", "2026-10-31")).toEqual(["2026-10-10"]);
    expect(occurrences(e, "2026-10-11", "2026-10-31")).toEqual([]);
  });

  it("marks cancelled sessions and skips drafts for the portal", () => {
    const list = sessions(
      [base, { ...base, id: "o2", status: "draft" }],
      [{ offering_id: "o1", session_date: "2026-10-05" }],
      "2026-10-05",
      "2026-10-07",
      { published: true },
    );
    expect(list.map((s) => [s.o.id, s.date, s.cancelled])).toEqual([
      ["o1", "2026-10-05", true],
      ["o1", "2026-10-07", false],
    ]);
  });
});

describe("dates", () => {
  it("weeks start on Monday", () => {
    expect(weekStart("2026-10-04")).toBe("2026-09-28");
    expect(weekStart("2026-09-28")).toBe("2026-09-28");
  });
  it("labels today and tomorrow", () => {
    expect(dayLabel("2026-10-03", "2026-10-03")).toBe("Today");
    expect(dayLabel(addDays("2026-10-03", 1), "2026-10-03")).toBe("Tomorrow");
  });
});

describe("sequences", () => {
  const steps = [
    { position: 0, channel: "email", delay_days: 0, subject: null, body: "a" },
    { position: 1, channel: "whatsapp", delay_days: 3, subject: null, body: "b" },
    { position: 2, channel: "email", delay_days: 5, subject: null, body: "c" },
  ];
  it("adds up delays from the enrollment date", () => {
    expect(stepDue("2026-10-01", steps, 0)).toBe("2026-10-01");
    expect(stepDue("2026-10-01", steps, 2)).toBe("2026-10-09");
  });
  it("finds the next unsent step", () => {
    expect(nextStep(steps, [0])).toBe(1);
    expect(nextStep(steps, [0, 1, 2])).toBe(-1);
  });
});

describe("priceLabel", () => {
  const o = { id: "o1", access: "members" } as Offering;
  const t = (x: Partial<TicketType>) =>
    ({ offering_id: "o1", price: 0, currency: "CRC", payment_link: null, pay_first: false, stripe_price_id: null, ...x }) as TicketType;
  it("keeps classes included for members", () => {
    expect(priceLabel(o, [])).toBe("Included for members");
    expect(priceLabel(o, [t({ price: 5000 })])).toBe("Included for members");
  });
  it("marks meals as paid when booking", () => {
    expect(priceLabel(o, [t({ pay_first: true })])).toBe("Paid when you book");
    expect(priceLabel(o, [t({ pay_first: true, price: 6000 })])).toBe("₡6,000");
  });
});

describe("flexible repeats", () => {
  it("every other week", () => {
    const o = { ...base, start_date: "2026-10-05", days: [1], repeat_every: 2 };
    expect(occurrences(o, "2026-10-05", "2026-11-09")).toEqual(["2026-10-05", "2026-10-19", "2026-11-02"]);
  });
  it("monthly on the 2nd Saturday", () => {
    const o = { ...base, repeat: "monthly", start_date: "2026-10-10", days: [6], month_mode: "weekday" };
    expect(occurrences(o, "2026-10-01", "2026-12-31")).toEqual(["2026-10-10", "2026-11-14", "2026-12-12"]);
  });
  it("monthly on the same day number, every 2 months", () => {
    const o = { ...base, repeat: "monthly", start_date: "2026-10-15", repeat_every: 2 };
    expect(occurrences(o, "2026-10-01", "2027-01-31")).toEqual(["2026-10-15", "2026-12-15"]);
  });
  it("specific dates", () => {
    const o = { ...base, repeat: "dates", custom_dates: ["2026-11-20", "2026-10-12", "2027-01-01"] };
    expect(occurrences(o, "2026-10-01", "2026-12-31")).toEqual(["2026-10-12", "2026-11-20"]);
  });
});
