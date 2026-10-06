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

import { priceOrder } from "@/lib/shop-cart";

describe("priceOrder", () => {
  const catalog = [
    { external_id: "48351634686106", name: "Green Pesto", product_group: "Green Pesto", variant: null, price: 4680 },
    { external_id: "48351634686107", name: "Kombucha · Ginger", product_group: "Kombucha", variant: "Ginger", price: 2500 },
  ];
  it("prices from the catalog with the member's discount", () => {
    const r = priceOrder(catalog, [{ id: "48351634686106", qty: 2 }, { id: "48351634686107", qty: 1 }], 20);
    expect(r).toEqual({
      lines: [
        { id: "48351634686106", name: "Green Pesto", label: null, qty: 2, list: 4680, unit: 3744 },
        { id: "48351634686107", name: "Kombucha", label: "Ginger", qty: 1, list: 2500, unit: 2000 },
      ],
      subtotal: 11860,
      total: 9488,
    });
  });
  it("refuses an empty basket or a product that is gone", () => {
    expect(priceOrder(catalog, [], 10)).toHaveProperty("error");
    expect(priceOrder(catalog, [{ id: "11111111111", qty: 1 }], 10)).toHaveProperty("error");
  });
  it("charges the full price to someone with no discount", () => {
    const r = priceOrder(catalog, [{ id: "48351634686106", qty: 1 }], 0);
    expect(r).toMatchObject({ total: 4680, subtotal: 4680 });
  });
});
