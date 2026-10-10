import { describe, expect, it } from "vitest";
import { dateRange, firstDateIn } from "@/lib/event-filters";

// 2026-10-10 is a Saturday.
describe("event date filters", () => {
  it("has no limit for All", () => {
    expect(dateRange("all", "2026-10-10")).toBeNull();
  });
  it("covers just today", () => {
    expect(dateRange("today", "2026-10-10")).toEqual(["2026-10-10", "2026-10-10"]);
  });
  it("runs from today to Sunday for this week", () => {
    expect(dateRange("week", "2026-10-07")).toEqual(["2026-10-07", "2026-10-11"]);
    expect(dateRange("week", "2026-10-11")).toEqual(["2026-10-11", "2026-10-11"]);
  });
  it("finds this weekend from any day", () => {
    expect(dateRange("weekend", "2026-10-07")).toEqual(["2026-10-10", "2026-10-11"]);
    expect(dateRange("weekend", "2026-10-10")).toEqual(["2026-10-10", "2026-10-11"]);
    expect(dateRange("weekend", "2026-10-11")).toEqual(["2026-10-11", "2026-10-11"]);
  });
  it("covers the rest of this month and all of next", () => {
    expect(dateRange("month", "2026-10-10")).toEqual(["2026-10-10", "2026-10-31"]);
    expect(dateRange("next-month", "2026-10-10")).toEqual(["2026-11-01", "2026-11-30"]);
    expect(dateRange("next-month", "2026-12-20")).toEqual(["2027-01-01", "2027-01-31"]);
  });
  it("picks the first date of an event inside the range", () => {
    const dates = ["2026-10-12", "2026-10-19", "2026-11-02"];
    expect(firstDateIn(dates, "all", "2026-10-10")).toBe("2026-10-12");
    expect(firstDateIn(dates, "week", "2026-10-10")).toBeNull();
    expect(firstDateIn(dates, "next-month", "2026-10-10")).toBe("2026-11-02");
  });
});
