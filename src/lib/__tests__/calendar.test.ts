import { describe, expect, it } from "vitest";
import { googleCalendarUrl, icsFile } from "@/lib/calendar";

const ev = {
  title: "Farm-to-table dinner",
  date: "2026-10-10",
  start: "18:30:00",
  end: "21:30:00",
  location: "Farm, The ARK",
  timeZone: "America/Costa_Rica",
};

describe("calendar", () => {
  it("converts Costa Rica time (UTC-6) for Google", () => {
    const u = new URL(googleCalendarUrl(ev));
    expect(u.searchParams.get("dates")).toBe("20261011T003000Z/20261011T033000Z");
  });
  it("builds a valid .ics", () => {
    const ics = icsFile({ ...ev, uid: "abc" });
    expect(ics).toContain("DTSTART:20261011T003000Z");
    expect(ics).toContain("SUMMARY:Farm-to-table dinner");
    expect(ics).toContain("LOCATION:Farm\\, The ARK");
  });
});
