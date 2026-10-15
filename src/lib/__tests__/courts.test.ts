import { describe, expect, it } from "vitest";
import { classAt, slots } from "@/lib/courts";

describe("courts", () => {
  it("makes slots between opening and closing", () => {
    const s = slots({ open_time: "07:00:00", close_time: "10:00:00", slot_minutes: 60 });
    expect(s).toEqual([
      { start: "07:00", end: "08:00" },
      { start: "08:00", end: "09:00" },
      { start: "09:00", end: "10:00" },
    ]);
    expect(slots({ open_time: "07:00", close_time: "08:30", slot_minutes: 60 })).toHaveLength(1);
  });

  it("blocks the matching court during a class at the courts", () => {
    const padel = { title: "Padel: Adults", location: "The Courts", start_time: "15:00:00", end_time: "16:00:00" };
    const slot = { start: "15:00", end: "16:00" };
    expect(classAt({ sport: "padel" }, slot, [padel])).toBe("Padel: Adults");
    expect(classAt({ sport: "pickleball" }, slot, [padel])).toBeNull();
    expect(classAt({ sport: "padel" }, { start: "16:00", end: "17:00" }, [padel])).toBeNull();
    const clinic = { ...padel, title: "Racket clinic" };
    expect(classAt({ sport: "pickleball" }, slot, [clinic])).toBe("Racket clinic");
    expect(classAt({ sport: "padel" }, slot, [{ ...padel, location: "The Shala" }])).toBeNull();
  });
});

import { addMinutes, courtMoney, durationLabel, durations, levelName, levelRange, lengthsOf, priceFor, share } from "@/lib/courts";

describe("courts online", () => {
  const list = [
    { key: "court_60", kind: "court", label: "1 hour", minutes: 60, price: 15000 },
    { key: "court_90", kind: "court", label: "1½ hours", minutes: 90, price: 23000 },
    { key: "court_120", kind: "court", label: "2 hours", minutes: 120, price: 30000 },
  ];

  it("knows the lengths a court can have", () => {
    expect(durations()).toEqual([60, 90, 120, 180]);
    expect(lengthsOf(list)).toEqual([60, 90, 120]);
  });

  it("prices a booking from the price list", () => {
    expect([60, 90, 120].map((m) => priceFor(list, m))).toEqual([15000, 23000, 30000]);
    expect(priceFor(list, 180)).toBe(0);
  });

  it("splits a court evenly between players", () => {
    expect(share(20000, 4, "CRC")).toBe(5000);
    expect(share(20000, 3, "CRC")).toBe(6667);
    expect(share(45, 4, "USD")).toBe(11.25);
  });

  it("formats money and lengths", () => {
    expect(courtMoney(20000, "CRC")).toBe("₡20,000");
    expect(courtMoney(11.25, "USD")).toBe("$11.25");
    expect(courtMoney(0, "CRC")).toBe("Free");
    expect(durationLabel(60)).toBe("1 hour");
    expect(durationLabel(90)).toBe("1½ hours");
    expect(durationLabel(180)).toBe("3 hours");
    expect(addMinutes("07:00", 90)).toBe("08:30");
  });

  it("names levels on the 0–7 scale", () => {
    expect(levelName(2.5)).toBe("Improver");
    expect(levelName(2.7)).toBe("Improver");
    expect(levelName(null)).toBe("");
    expect(levelRange(1.5, 3.5)).toBe("1.5–3.5");
    expect(levelRange(null, 3)).toBe("");
  });
});
