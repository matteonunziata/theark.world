import { describe, expect, it } from "vitest";
import { PASS_STATE, passOk, passReason } from "@/lib/pass";

const base = { tier_name: "Day Pass", period: "day", valid_from: null, valid_until: null, activate_by: "2027-01-04" };

describe("a pass without a photo", () => {
  it("is red at the gate and says why", () => {
    expect(passOk("no_photo")).toBe(false);
    expect(PASS_STATE.no_photo).toBe("Needs a photo");
    expect(passReason({ ...base, state: "no_photo" })).toMatch(/no photo/i);
  });
  it("is green once the photo is on file", () => {
    expect(passOk("unused")).toBe(true);
  });
});
