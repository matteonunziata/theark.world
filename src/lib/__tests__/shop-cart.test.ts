import { describe, expect, it } from "vitest";
import { checkoutUrl, cleanCart, memberPrice } from "@/lib/shop-cart";

describe("memberPrice", () => {
  it("takes the percentage off and rounds to a colón", () => {
    expect(memberPrice(4680, 10)).toBe(4212);
    expect(memberPrice(4680, 20)).toBe(3744);
    expect(memberPrice(950, 10)).toBe(855);
    expect(memberPrice(4680, 0)).toBe(4680);
  });
});

describe("cleanCart", () => {
  it("merges repeats, caps quantity and drops junk", () => {
    expect(
      cleanCart([
        { id: "48351634686106", qty: 2 },
        { id: "48351634686106", qty: 3 },
        { id: "99999999999999", qty: 500 },
        { id: "abc", qty: 1 },
        { id: "48351634686107", qty: 0 },
        null,
      ]),
    ).toEqual([
      { id: "48351634686106", qty: 5 },
      { id: "99999999999999", qty: 20 },
    ]);
    expect(cleanCart("nope")).toEqual([]);
  });
});

describe("checkoutUrl", () => {
  const lines = [
    { id: "48351634686106", qty: 2 },
    { id: "48351634686107", qty: 1 },
  ];
  it("makes a cart link with the member's code and email", () => {
    expect(checkoutUrl(lines, { code: "member10", email: "a@b.com" })).toBe(
      "https://thearkfarm.shop/cart/48351634686106:2,48351634686107:1?discount=member10&checkout%5Bemail%5D=a%40b.com",
    );
  });
  it("works without a code", () => {
    expect(checkoutUrl(lines)).toBe("https://thearkfarm.shop/cart/48351634686106:2,48351634686107:1");
  });
  it("gives nothing for an empty cart", () => {
    expect(checkoutUrl([], { code: "member10" })).toBeNull();
  });
});
