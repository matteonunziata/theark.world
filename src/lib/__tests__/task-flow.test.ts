import { describe, expect, it } from "vitest";
import { flowStep, fmtMinutes, fmtStart, parseHours } from "../tasks";

describe("task flow", () => {
  it("walks clock in, before, work, after", () => {
    expect(flowStep(false, 0, 0)).toBe("clock_in");
    expect(flowStep(true, 0, 0)).toBe("before");
    expect(flowStep(true, 2, 0)).toBe("work");
    expect(flowStep(true, 2, 1)).toBe("clock_out");
  });
  it("reads hours typed by hand", () => {
    expect(parseHours("1.5")).toBe(90);
    expect(parseHours("1,5")).toBe(90);
    expect(parseHours("1:30")).toBe(90);
    expect(parseHours("0")).toBeNull();
    expect(parseHours("30")).toBeNull();
    expect(parseHours("abc")).toBeNull();
  });
  it("formats durations and start times", () => {
    expect(fmtMinutes(90)).toBe("1 h 30 min");
    expect(fmtMinutes(120)).toBe("2 h");
    expect(fmtMinutes(20)).toBe("20 min");
    expect(fmtStart("08:30:00")).toBe("8:30 am");
    expect(fmtStart("13:05")).toBe("1:05 pm");
  });
});
