import { describe, expect, it } from "vitest";
import { fmtSum, fmtTotals, overdueDays, sumIn, totals } from "../finance";
import { age, firstName } from "../school";

describe("finance totals", () => {
  it("keeps currencies apart", () => {
    const t = totals([
      { amount: 1000, currency: "CRC" },
      { amount: 40, currency: "USD" },
    ]);
    expect(t).toEqual({ CRC: 1000, USD: 40 });
    expect(fmtTotals(t)).toBe("₡1,000 + $40");
    expect(fmtTotals({})).toBe("₡0");
  });
});

describe("finance currency toggle", () => {
  const rows = [
    { amount: 1000, currency: "CRC" },
    { amount: 2500, currency: "CRC" },
    { amount: 40, currency: "USD" },
  ];
  it("converts to colones at the rate", () => {
    const c = { to: "CRC", rate: 500 } as const;
    expect(sumIn(rows, c)).toEqual({ value: 23500, approx: true });
    expect(fmtSum(rows, c)).toBe("~₡23,500");
  });

  it("converts to dollars at the rate", () => {
    const c = { to: "USD", rate: 500 } as const;
    expect(sumIn(rows, c).value).toBeCloseTo(47);
    expect(fmtSum(rows, c)).toBe("~$47");
  });

  it("is exact when nothing needed converting", () => {
    const c = { to: "CRC", rate: 500 } as const;
    expect(fmtSum(rows.slice(0, 2), c)).toBe("₡3,500");
    expect(fmtSum([], c)).toBe("₡0");
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
