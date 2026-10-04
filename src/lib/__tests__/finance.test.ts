import { describe, expect, it } from "vitest";
import { fmtTotals, overdueDays, totals } from "../finance";
import { age, firstName } from "../school";

describe("finance totals", () => {
  it("keeps currencies apart", () => {
    const t = totals([
      { amount: 1000, currency: "CRC" },
      { amount: 2500, currency: "CRC" },
      { amount: 40, currency: "USD" },
    ]);
    expect(t).toEqual({ CRC: 3500, USD: 40 });
    expect(fmtTotals(t)).toBe("₡3,500 + $40");
  });

  it("shows zero in the main currency when empty", () => {
    expect(fmtTotals({})).toBe("₡0");
    expect(fmtTotals({ USD: 10 })).toBe("₡0 + $10");
  });

  it("counts days past due", () => {
    expect(overdueDays("2026-10-01", "2026-10-04")).toBe(3);
    expect(overdueDays("2026-10-10", "2026-10-04")).toBe(-6);
    expect(overdueDays(null, "2026-10-04")).toBeNull();
  });
});

describe("school helpers", () => {
  it("counts whole years", () => {
    expect(age("2018-10-05", "2026-10-04")).toBe(7);
    expect(age("2018-10-04", "2026-10-04")).toBe(8);
    expect(age(null, "2026-10-04")).toBeNull();
  });
  it("prefers the name they go by", () => {
    expect(firstName({ name: "Isabella Mora", preferred_name: "Isa" })).toBe("Isa");
    expect(firstName({ name: "Isabella Mora" })).toBe("Isabella");
  });
});
