import { describe, expect, it } from "vitest";
import { diffTags, levelForPercent, LEVELS, levelOn, type MembershipRow, normalizeShop } from "@/lib/shopify-map";

const row = (o: Partial<MembershipRow> = {}): MembershipRow => ({
  status: "active",
  starts_on: "2026-10-01",
  ends_on: "2026-10-31",
  period: "month",
  court_discount: 10,
  ...o,
});
const [m20, m10] = LEVELS;

describe("levelOn", () => {
  it("gives member10 to a monthly, quarterly or half-year membership", () => {
    expect(levelOn([row()], "2026-10-06")).toBe(m10);
    expect(levelOn([row({ period: "quarter" })], "2026-10-06")).toBe(m10);
    expect(levelOn([row({ period: "half" })], "2026-10-06")).toBe(m10);
  });
  it("gives member20 to annual", () => {
    expect(levelOn([row({ period: "year", court_discount: 20 })], "2026-10-06")).toBe(m20);
  });
  it("takes the best of overlapping memberships", () => {
    expect(levelOn([row(), row({ period: "year", court_discount: 20 })], "2026-10-06")).toBe(m20);
  });
  it("ends with the last day, inclusive", () => {
    expect(levelOn([row()], "2026-10-31")).toBe(m10);
    expect(levelOn([row()], "2026-11-01")).toBeNull();
  });
  it("waits for the start date", () => {
    expect(levelOn([row({ starts_on: "2026-10-10" })], "2026-10-06")).toBeNull();
  });
  it("open-ended memberships stay valid", () => {
    expect(levelOn([row({ ends_on: null })], "2030-01-01")).toBe(m10);
  });
  it("lets a cancelled subscription run to its end", () => {
    expect(levelOn([row({ status: "cancelled" })], "2026-10-20")).toBe(m10);
  });
  it("gives nothing for paused, revoked, unused or passes", () => {
    for (const status of ["paused", "revoked", "unused"]) expect(levelOn([row({ status })], "2026-10-06")).toBeNull();
    expect(levelOn([row({ period: "day", court_discount: 10 })], "2026-10-06")).toBeNull();
    expect(levelOn([row({ period: "week", court_discount: 10 })], "2026-10-06")).toBeNull();
  });
  it("gives nothing when the tier has no discount", () => {
    expect(levelOn([row({ court_discount: 0 })], "2026-10-06")).toBeNull();
    expect(levelOn([row({ court_discount: null })], "2026-10-06")).toBeNull();
  });
});

describe("levelForPercent", () => {
  it("maps to the nearest code at or below", () => {
    expect(levelForPercent(20)).toBe(m20);
    expect(levelForPercent(15)).toBe(m10);
    expect(levelForPercent(10)).toBe(m10);
    expect(levelForPercent(5)).toBeNull();
  });
});

describe("normalizeShop", () => {
  it("accepts the forms people paste", () => {
    expect(normalizeShop("theark")).toBe("theark.myshopify.com");
    expect(normalizeShop("https://theark.myshopify.com/admin")).toBe("theark.myshopify.com");
    expect(normalizeShop("https://admin.shopify.com/store/theark/settings")).toBe("theark.myshopify.com");
    expect(normalizeShop("THEARK.myshopify.com")).toBe("theark.myshopify.com");
  });
  it("refuses a custom domain or nonsense", () => {
    expect(normalizeShop("shop.theark.world")).toBeNull();
    expect(normalizeShop("")).toBeNull();
    expect(normalizeShop("a b")).toBeNull();
  });
});

describe("diffTags", () => {
  const want = new Map([
    ["a@x.com", m10],
    ["b@x.com", m20],
  ]);
  it("adds the tag to a member who is missing it", () => {
    const d = diffTags({ want, have: [{ id: "1", email: "A@x.com", tags: ["vip"] }] });
    expect(d).toContainEqual({ id: "1", email: "a@x.com", add: [m10.tag], remove: [] });
  });
  it("leaves a customer who is already right", () => {
    const d = diffTags({ want: new Map([["a@x.com", m10]]), have: [{ id: "1", email: "a@x.com", tags: [m10.tag, "vip"] }] });
    expect(d).toEqual([]);
  });
  it("moves a customer between levels without touching other tags", () => {
    const d = diffTags({ want: new Map([["a@x.com", m20]]), have: [{ id: "1", email: "a@x.com", tags: [m10.tag, "vip"] }] });
    expect(d).toEqual([{ id: "1", email: "a@x.com", add: [m20.tag], remove: [m10.tag] }]);
  });
  it("strips the tag from someone whose membership has ended", () => {
    const d = diffTags({ want: new Map(), have: [{ id: "9", email: "gone@x.com", tags: [m20.tag] }] });
    expect(d).toEqual([{ id: "9", email: "gone@x.com", add: [], remove: [m20.tag] }]);
  });
  it("asks for a new customer when a member isn't in Shopify yet", () => {
    const d = diffTags({ want: new Map([["new@x.com", m10]]), have: [] });
    expect(d).toEqual([{ id: null, email: "new@x.com", add: [m10.tag], remove: [] }]);
  });
});
