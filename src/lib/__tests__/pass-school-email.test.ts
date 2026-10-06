import { describe, expect, it } from "vitest";
import { arkEmail, textToHtml } from "@/lib/email-template";
import { passCode, passOk, passReason, passValidity } from "@/lib/pass";
import { scheduleFor } from "@/lib/school";

describe("member passes", () => {
  it("prints a short gate code", () => {
    expect(passCode("abcdef0123456789abcdef0123456789xyz12f")).toBe("MEM-XYZ12F");
  });

  it("describes what the pass covers", () => {
    expect(
      passValidity({ tier_name: "Day pass", period: "day", valid_from: "2026-10-04", valid_until: "2026-10-04", activate_by: "2027-01-02" }),
    ).toBe("Day pass, Oct 4, 2026");
    expect(passValidity({ tier_name: "Day pass", period: "day", valid_from: null, valid_until: null, activate_by: "2027-01-04" })).toBe(
      "Day pass, use by Jan 4, 2027",
    );
    expect(passValidity({ tier_name: "Annual", period: "year", valid_from: null, valid_until: null, activate_by: null })).toBe(
      "Annual, any day, any hour",
    );
    expect(passValidity({ tier_name: "Standard", period: "month", valid_from: null, valid_until: "2027-08-24", activate_by: null })).toBe(
      "Standard, until Aug 24, 2027",
    );
  });

  it("tells security why the screen is green or red", () => {
    const base = { tier_name: "Week pass", period: "week", valid_from: null, valid_until: null, activate_by: null };
    expect(passReason({ ...base, state: "expired", valid_until: "2026-10-03" })).toBe("Expired Oct 3");
    expect(passReason({ ...base, state: "expired", activate_by: "2027-01-04" })).toBe("Not used by Jan 4");
    expect(passReason({ ...base, state: "not_started", valid_from: "2026-10-12" })).toBe("Starts Oct 12");
    expect(passReason({ ...base, state: "unused", activate_by: "2027-01-04" })).toBe("Week pass, first visit. Use by Jan 4");
    expect(passReason({ ...base, state: "checked_in", checked_in_at: "2026-10-05T15:12:00Z" })).toBe(
      "Already checked in at 9:12 AM",
    );
    expect(passReason({ ...base, state: "valid", valid_from: "2026-10-05", valid_until: "2026-10-11" })).toBe(
      "Week pass, until Oct 11",
    );
    expect(passOk("unused")).toBe(true);
    expect(passOk("checked_in")).toBe(false);
  });
});

describe("school timetable", () => {
  const entries = [
    { id: "a", weekday: 1, on_date: null, start_time: "09:00" },
    { id: "b", weekday: 1, on_date: null, start_time: "08:00" },
    { id: "c", weekday: 2, on_date: null, start_time: "08:00" },
    { id: "d", weekday: null, on_date: "2026-10-05", start_time: "13:00" },
  ];
  it("combines the weekly rhythm with one-off days, in time order", () => {
    // 2026-10-05 is a Monday.
    expect(scheduleFor(entries, "2026-10-05").map((e) => e.id)).toEqual(["b", "a", "d"]);
    expect(scheduleFor(entries, "2026-10-12").map((e) => e.id)).toEqual(["b", "a"]);
  });
});

describe("email template", () => {
  it("escapes what people type and links URLs", () => {
    const html = textToHtml("Hi <b>Ana</b>\n\nSee https://theark.world/portal.");
    expect(html).toContain("&#60;b&#62;Ana&#60;/b&#62;");
    expect(html).toContain('<a href="https://theark.world/portal"');
    expect(html.match(/<p /g)).toHaveLength(2);
  });

  it("wraps content in the ARK layout", () => {
    const html = arkEmail({ origin: "https://x.test", heading: "Hello", body: "<p>Body</p>", cta: { label: "Open", href: "https://x.test/a" } });
    expect(html).toContain("https://x.test/brand/ark-lockup-light.png");
    expect(html).toContain(">Hello</h1>");
    expect(html).toContain('href="https://x.test/a"');
  });
});
