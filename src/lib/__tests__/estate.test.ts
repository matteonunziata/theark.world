import { describe, expect, it } from "vitest";
import { area, coversNight, monthGrid, nights, occupancy, overlaps } from "@/lib/estate";

describe("stays", () => {
  it("counts nights, not days", () => {
    expect(nights("2026-10-04", "2026-10-07")).toBe(3);
  });

  it("lets a guest check in on another's check-out day", () => {
    const a = { check_in: "2026-10-01", check_out: "2026-10-05" };
    expect(overlaps(a, { check_in: "2026-10-05", check_out: "2026-10-08" })).toBe(false);
    expect(overlaps(a, { check_in: "2026-10-04", check_out: "2026-10-08" })).toBe(true);
    expect(coversNight(a, "2026-10-04")).toBe(true);
    expect(coversNight(a, "2026-10-05")).toBe(false);
  });

  it("measures occupancy from confirmed guest nights only", () => {
    const stays = [
      { check_in: "2026-10-01", check_out: "2026-10-06", status: "confirmed", kind: "guest" },
      { check_in: "2026-10-06", check_out: "2026-10-08", status: "inquiry", kind: "guest" },
      { check_in: "2026-10-08", check_out: "2026-10-10", status: "confirmed", kind: "owner" },
    ];
    // 2 homes × 10 nights; 5 booked (Oct 1–5).
    expect(occupancy(stays, 2, "2026-10-01", "2026-10-11")).toBe(0.25);
  });
});

describe("monthGrid", () => {
  it("starts on the Monday on or before the 1st and spans six weeks", () => {
    const g = monthGrid("2026-10-17");
    expect(g.first).toBe("2026-10-01");
    expect(g.days[0]).toBe("2026-09-28");
    expect(g.days).toHaveLength(42);
  });
});

describe("area", () => {
  it("switches to hectares for big lots", () => {
    expect(area(2400)).toBe("2,400 m²");
    expect(area(25000)).toBe("2.5 ha");
    expect(area(null)).toBeNull();
  });
});
