import { describe, expect, it } from "vitest";
import { portalWelcomeTier } from "@/lib/crm";

describe("portalWelcomeTier", () => {
  it("is true for a month or longer, false for passes and the team", () => {
    expect(portalWelcomeTier({ key: "standard", period: "month" })).toBe(true);
    expect(portalWelcomeTier({ key: "annual", period: "year" })).toBe(true);
    expect(portalWelcomeTier({ key: "founding", period: "once" })).toBe(true);
    expect(portalWelcomeTier({ key: "day", period: "day" })).toBe(false);
    expect(portalWelcomeTier({ key: "week", period: "week" })).toBe(false);
    expect(portalWelcomeTier({ key: "team", period: "month" })).toBe(false);
    expect(portalWelcomeTier(null)).toBe(false);
  });
});
