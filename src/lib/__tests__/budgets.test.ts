import { describe, expect, it } from "vitest";
import { budgetStats, periodLabel, touchesMonth, used } from "../budgets";

const lines = [
  { id: "a", planned_crc: 100000 },
  { id: "b", planned_crc: 50000 },
];
const t = (line_id: string, movements_crc: number, paid_crc = 0, requested_crc = 0) => ({
  line_id,
  budget_id: "x",
  movements_crc,
  paid_crc,
  requested_crc,
});

describe("budget numbers", () => {
  it("counts expenses on a monthly budget", () => {
    const s = budgetStats("monthly", lines, [t("a", 40000), t("b", 5000)]);
    expect(s).toEqual({ planned: 150000, spent: 45000, remaining: 105000, pct: 30 });
  });

  it("counts paid plus requested on a project budget, not expenses", () => {
    expect(used("project", t("a", 999, 30000, 20000))).toBe(50000);
    expect(used("monthly", t("a", 999, 30000, 20000))).toBe(999);
  });

  it("goes negative and past 100% when a budget is over", () => {
    const s = budgetStats("monthly", lines, [t("a", 200000)]);
    expect(s.remaining).toBe(-50000);
    expect(s.pct).toBe(133);
  });

  it("handles no lines and no spending", () => {
    expect(budgetStats("monthly", [], [])).toEqual({ planned: 0, spent: 0, remaining: 0, pct: 0 });
  });
});

describe("budget periods", () => {
  it("labels months and project ranges", () => {
    expect(periodLabel({ type: "monthly", period_month: "2026-10-01", start_date: null, end_date: null })).toBe("October 2026");
    expect(periodLabel({ type: "project", period_month: null, start_date: "2026-10-05", end_date: "2026-12-20" })).toBe("Oct 5, 2026 – Dec 20, 2026");
  });

  it("matches a month filter", () => {
    const m = { type: "monthly", period_month: "2026-10-01", start_date: null, end_date: null };
    const p = { type: "project", period_month: null, start_date: "2026-10-20", end_date: "2026-12-05" };
    expect(touchesMonth(m, "2026-10")).toBe(true);
    expect(touchesMonth(m, "2026-11")).toBe(false);
    expect(touchesMonth(p, "2026-11")).toBe(true);
    expect(touchesMonth(p, "2027-01")).toBe(false);
  });
});
