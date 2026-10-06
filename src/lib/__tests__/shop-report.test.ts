import { describe, expect, it } from "vitest";
import { fmtCompact } from "@/lib/shop";
import {
  attention,
  daysOfCover,
  EMPTY_REPORT,
  fillDays,
  fmtChange,
  hourRows,
  parseReport,
  seriesFor,
  slowMovers,
  spanDays,
  type StockProduct,
  weekdayRows,
} from "@/lib/shop-report";

const day = (day: string, revenue: number, orders = 1) => ({ day, revenue, orders, units: orders });

describe("shop report series", () => {
  it("fills the days nothing sold", () => {
    const rows = fillDays([day("2026-10-02", 5000)], "2026-10-01", "2026-10-03");
    expect(rows.map((r) => r.revenue)).toEqual([0, 5000, 0]);
    expect(spanDays("2026-10-01", "2026-10-03")).toBe(3);
  });
  it("shows days for a month and weeks for longer", () => {
    const month = seriesFor([day("2026-10-02", 5000)], "2026-09-06", "2026-10-05");
    expect(month.unit).toBe("day");
    expect(month.rows).toHaveLength(30);
    const quarter = seriesFor([day("2026-10-02", 5000), day("2026-10-03", 1000)], "2026-07-08", "2026-10-05");
    expect(quarter.unit).toBe("week");
    // Both days fall in the week of Monday 28 September.
    const w = quarter.rows.find((r) => r.label === "Sep 28");
    expect(w?.value).toBe(6000);
    expect(w?.note).toContain("2 orders");
    expect(quarter.rows.length).toBe(14); // Jul 6 … Oct 5
  });
  it("describes the change against the period before", () => {
    expect(fmtChange(1200, 1000)).toBe("+20%");
    expect(fmtChange(900, 1000)).toBe("−10%");
    expect(fmtChange(1000, 1000)).toBe("same as before");
    expect(fmtChange(1000, 0)).toBe("");
  });
  it("lays out hours and weekdays", () => {
    const hours = hourRows([{ hour: 9, revenue: 1, orders: 4 }]);
    expect(hours[0].label).toBe("7am");
    expect(hours.at(-1)?.label).toBe("6pm");
    expect(hours.find((h) => h.label === "9am")?.value).toBe(4);
    const week = weekdayRows([{ dow: 0, revenue: 300, orders: 2 }]);
    expect(week.map((w) => w.label)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(week[6].value).toBe(300);
  });
});

const product = (over: Partial<StockProduct>): StockProduct => ({
  id: "p",
  name: "Eggs",
  unit: null,
  stock: 10,
  low_at: 2,
  track_stock: true,
  price: 100,
  online: true,
  category: "Pantry",
  ...over,
});

describe("stock attention", () => {
  it("works out days of cover", () => {
    expect(daysOfCover(10, 30, 30)).toBe(10);
    expect(daysOfCover(10, 0, 30)).toBeNull();
  });
  it("flags out, low and running-out products in that order", () => {
    const report = {
      ...EMPTY_REPORT,
      products: [
        { id: "fast", name: "Greens", category: "", unit: null, revenue: 1, units: 60, orders: 1, last_sold: "" },
      ],
    };
    const list = attention(
      [
        product({ id: "fast", name: "Greens", stock: 8 }), // 2/day, 4 days left
        product({ id: "low", name: "Kale", stock: 2 }),
        product({ id: "out", name: "Basil", stock: 0 }),
        product({ id: "fine", name: "Jam", stock: 40 }),
        product({ id: "uncounted", name: "Tea", stock: 0, track_stock: false }),
      ],
      report,
      30,
    );
    expect(list.map((a) => `${a.name}:${a.state}`)).toEqual(["Basil:out", "Kale:low", "Greens:soon"]);
    expect(list[2].cover).toBe(4);
  });
  it("lists what didn't sell", () => {
    const report = { ...EMPTY_REPORT, products: [{ id: "a", name: "A", category: "", unit: null, revenue: 1, units: 1, orders: 1, last_sold: "" }] };
    expect(slowMovers([product({ id: "a", name: "A" }), product({ id: "b", name: "B" })], report).map((p) => p.id)).toEqual(["b"]);
  });
});

describe("report parsing and money", () => {
  it("copes with an empty or odd payload", () => {
    expect(parseReport(null)).toEqual(EMPTY_REPORT);
    const r = parseReport({ totals: { revenue: "1200.50", orders: 3 }, days: [{ day: "2026-10-01", revenue: "5" }] });
    expect(r.totals.revenue).toBe(1200.5);
    expect(r.totals.units).toBe(0);
    expect(r.days[0]).toEqual({ day: "2026-10-01", revenue: 5, orders: 0, units: 0 });
  });
  it("writes money compactly", () => {
    expect(fmtCompact(640)).toBe("₡640");
    expect(fmtCompact(85_000)).toBe("₡85k");
    expect(fmtCompact(2_141_880)).toBe("₡2.1M");
    expect(fmtCompact(1_250, "USD")).toBe("$1.3k");
    expect(fmtCompact(-3000)).toBe("−₡3k");
  });
});
