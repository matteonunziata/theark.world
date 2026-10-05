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
