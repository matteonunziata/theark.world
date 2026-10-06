import { describe, expect, it } from "vitest";
import { crDay, guessLine } from "../stripe-import-map";

describe("guessLine", () => {
  it("puts passes and memberships under Memberships", () => {
    expect(guessLine("Day Pass Membership").line).toBe("Memberships");
    expect(guessLine("ARK Monthly membership").category).toBe("Membership dues");
  });
  it("recognises courts before passes", () => {
    expect(guessLine("Padel court pass").line).toBe("Courts");
  });
  it("recognises food, events and the farm", () => {
    expect(guessLine("Breakfast").line).toBe("Food & beverage");
    expect(guessLine("Full moon sound bath").line).toBe("Events & experiences");
    expect(guessLine("Farm box").line).toBe("Farm shop");
  });
  it("falls back to Other", () => {
    expect(guessLine("")).toEqual({ line: "Other", category: null });
    expect(guessLine("Invoice 0042")).toEqual({ line: "Other", category: null });
  });
});

describe("crDay", () => {
  it("uses Costa Rica's calendar day (UTC-6)", () => {
    // 2025-03-05 03:00 UTC is still 4 March in Costa Rica.
    expect(crDay(Date.UTC(2025, 2, 5, 3, 0) / 1000)).toBe("2025-03-04");
  });
});
