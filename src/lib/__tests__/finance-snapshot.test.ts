import { describe, expect, it } from "vitest";
import { buildSnapshot, pctChange } from "../finance-snapshot";

const e = (over: Partial<Parameters<typeof buildSnapshot>[0]["entries"][number]>) => ({
  kind: "income" as const,
  amount: 1000,
  currency: "CRC",
  entry_date: "2026-10-05",
  status: "paid",
  due_date: null,
  category: null,
  business_line_id: null,
  ...over,
});

const base = {
  month: "2026-10",
  today: "2026-10-10",
  conv: { to: "CRC", rate: 500 } as const,
  cash: null,
  lineName: (id: string | null) => id ?? "Not assigned",
};

describe("finance snapshot", () => {
  it("compares with last month", () => {
    const s = buildSnapshot({
      ...base,
      entries: [
        e({ amount: 3000 }),
        e({ kind: "expense", amount: 1000 }),
        e({ entry_date: "2026-09-12", amount: 2000 }),
        e({ entry_date: "2026-09-12", kind: "expense", amount: 1000 }),
      ],
    });
    expect(s.month).toEqual({ rev: 3000, exp: 1000, net: 2000, margin: 2 / 3 });
    expect(s.prev.rev).toBe(2000);
    expect(s.delta.rev).toBeCloseTo(0.5);
    expect(s.delta.exp).toBe(0);
    expect(pctChange(5, 0)).toBeNull();
  });

  it("adds up the year to date, not later months", () => {
    const s = buildSnapshot({
      ...base,
      entries: [
        e({ entry_date: "2026-01-02", amount: 100 }),
        e({ entry_date: "2026-10-02", amount: 200 }),
        e({ entry_date: "2026-11-02", amount: 400 }),
        e({ entry_date: "2025-12-02", amount: 800 }),
      ],
    });
    expect(s.ytd.rev).toBe(300);
  });

  it("finds overdue and soon-due unpaid items", () => {
    const s = buildSnapshot({
      ...base,
      entries: [
        e({ kind: "expense", status: "unpaid", due_date: "2026-10-01", amount: 500 }),
        e({ kind: "expense", status: "unpaid", due_date: "2026-10-14", amount: 700 }),
        e({ kind: "expense", status: "unpaid", due_date: "2026-11-30", amount: 900 }),
        e({ status: "unpaid", due_date: "2026-10-09", amount: 300 }),
        e({ kind: "expense", status: "paid", due_date: "2026-10-01", amount: 999 }),
      ],
    });
    expect(s.attention.overdueAP).toEqual({ n: 1, amount: 500 });
    expect(s.attention.dueSoonAP).toEqual({ n: 1, amount: 700 });
    expect(s.attention.overdueAR).toEqual({ n: 1, amount: 300 });
  });

  it("works out months of cash from recent spending", () => {
    const s = buildSnapshot({
      ...base,
      cash: 9000,
      entries: [
        e({ kind: "expense", entry_date: "2026-09-03", amount: 2000 }),
        e({ kind: "expense", entry_date: "2026-08-03", amount: 4000 }),
      ],
    });
    expect(s.runway.avgExpenses).toBe(3000);
    expect(s.runway.months).toBe(3);
    expect(buildSnapshot({ ...base, cash: 9000, entries: [] }).runway.months).toBeNull();
  });

  it("ranks categories and groups the tail", () => {
    const s = buildSnapshot({
      ...base,
      entries: ["a", "b", "c", "d", "e", "f", "g"].map((c, i) =>
        e({ kind: "expense", category: c, amount: 100 * (7 - i) }),
      ),
    });
    expect(s.topExpenses.map((x) => x.label)).toEqual(["a", "b", "c", "d", "e", "Everything else"]);
    expect(s.topExpenses.at(-1)?.amount).toBe(300);
    expect(s.topExpenses.reduce((t, x) => t + x.share, 0)).toBeCloseTo(1);
  });

  it("converts dollars and says so", () => {
    const s = buildSnapshot({ ...base, entries: [e({ amount: 10, currency: "USD" })] });
    expect(s.month.rev).toBe(5000);
    expect(s.approx).toBe(true);
    expect(buildSnapshot({ ...base, entries: [e({})] }).approx).toBe(false);
  });
});
