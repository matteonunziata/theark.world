import { describe, expect, it } from "vitest";
import { PLANS, stayCost } from "@/app/(public)/ark-membership/plans";

const plan = (k: string) => PLANS.find((p) => p.key === k)!;
const stay = { weeks: 13, daysPerWeek: 5, guestsPerMonth: 0, extrasPerMonth: 0 };

describe("membership stay cost", () => {
  it("counts three monthly renewals for three months", () => {
    expect(stayCost(plan("month"), stay).access).toBe(390_000);
    expect(stayCost(plan("quarter"), stay).access).toBe(340_000);
  });
  it("charges at least one period for a short stay", () => {
    expect(stayCost(plan("year"), { ...stay, weeks: 1 }).access).toBe(1_100_000);
  });
  it("charges guests over the allowance and credits member savings", () => {
    const r = stayCost(plan("month"), { weeks: 52 / 12, daysPerWeek: 5, guestsPerMonth: 6, extrasPerMonth: 100_000 });
    expect(r.guests).toBeCloseTo(40_000);
    expect(r.savings).toBeCloseTo(10_000);
  });
});
