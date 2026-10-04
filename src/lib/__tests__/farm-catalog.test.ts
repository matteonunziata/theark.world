import { describe, expect, it } from "vitest";
import { categoryFor, plainText, toRows } from "../farm-catalog";

const eggs = {
  id: 1,
  title: "Farm  Eggs",
  handle: "farm-eggs",
  body_html: "<p>Happy jungle chickens.</p>",
  variants: [
    { id: 11, title: "30", price: "5640.00", available: true },
    { id: 12, title: "12", price: "3100.00", available: false },
  ],
  images: [
    { src: "https://cdn.example/a.jpg?v=1", variant_ids: [] },
    { src: "https://cdn.example/b.jpg?v=1", variant_ids: [12] },
  ],
};

describe("farm catalog", () => {
  it("makes one row per variant with its own price, photo and availability", () => {
    const rows = toRows([eggs], { "plant-milks": ["farm-eggs"] });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      external_id: "11",
      name: "Farm Eggs · 30",
      product_group: "Farm Eggs",
      variant: "30",
      category: "Plant milks, cheese & eggs",
      price: 5640,
      online: true,
      image_url: "https://cdn.example/a.jpg?v=1&width=800",
      description: "Happy jungle chickens.",
      web_url: "https://thearkfarm.shop/products/farm-eggs",
    });
    expect(rows[1]).toMatchObject({ online: false, image_url: "https://cdn.example/b.jpg?v=1&width=800" });
  });

  it("keeps the plain name for single-variant products", () => {
    const [row] = toRows(
      [{ ...eggs, title: "Kimchi", handle: "kimchi", variants: [{ id: 5, title: "Default Title", price: "4680.00", available: true }] }],
      {},
    );
    expect(row.name).toBe("Kimchi");
    expect(row.variant).toBeNull();
  });

  it("puts products outside any collection in produce or pantry", () => {
    expect(categoryFor("kale", "Kale", {})).toBe("Fruit & vegetables");
    expect(categoryFor("pickled-cucumbers", "Pickled cucumbers", {})).toBe("Pantry");
    expect(categoryFor("kimchi", "Kimchi", {})).toBe("Pantry");
  });

  it("turns shop HTML into plain text", () => {
    expect(plainText("<p>One &amp; two</p><p>Three</p>")).toBe("One & two\nThree");
    expect(plainText("")).toBeNull();
  });
});
