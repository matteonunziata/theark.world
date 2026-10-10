import { describe, expect, it } from "vitest";
import { type ProductNode, toProductRows, type VariantNode } from "@/lib/shopify-products-map";

const variant = (o: Partial<VariantNode> = {}): VariantNode => ({
  id: "gid://shopify/ProductVariant/111",
  title: "Default Title",
  price: "2500.00",
  sku: " EGG-30 ",
  barcode: "",
  inventoryQuantity: 12,
  availableForSale: true,
  media: { nodes: [] },
  ...o,
});
const product = (o: Partial<ProductNode> = {}): ProductNode => ({
  id: "gid://shopify/Product/9",
  title: "  Farm   Eggs ",
  handle: "farm-eggs",
  status: "ACTIVE",
  descriptionHtml: "<p>Pasture raised.</p>",
  onlineStoreUrl: "https://thearkfarm.shop/products/farm-eggs",
  featuredMedia: { preview: { image: { url: "https://cdn.shopify.com/e.jpg" } } },
  collections: { nodes: [{ handle: "plant-milks" }] },
  variants: { nodes: [variant()], pageInfo: { hasNextPage: false } },
  ...o,
});

describe("toProductRows", () => {
  it("makes one row per variant with Shopify's ids", () => {
    const rows = toProductRows([product({ variants: { nodes: [variant(), variant({ id: "gid://shopify/ProductVariant/112", title: "30" })], pageInfo: { hasNextPage: false } } })]);
    expect(rows.map((r) => r.external_id)).toEqual(["111", "112"]);
    expect(rows[0]).toMatchObject({ name: "Farm Eggs", variant: null, product_group: "Farm Eggs", shopify_product_id: "9" });
    expect(rows[1]).toMatchObject({ name: "Farm Eggs · 30", variant: "30" });
  });
  it("carries sku, barcode and Shopify's count", () => {
    const [r] = toProductRows([product()]);
    expect(r.sku).toBe("EGG-30");
    expect(r.barcode).toBeNull();
    expect(r.shopify_stock).toBe(12);
    expect(r.price).toBe(2500);
  });
  it("is for sale online only when active, published and buyable", () => {
    expect(toProductRows([product()])[0].online).toBe(true);
    expect(toProductRows([product({ status: "ARCHIVED" })])[0].online).toBe(false);
    expect(toProductRows([product({ status: "DRAFT" })])[0].online).toBe(false);
    expect(toProductRows([product({ onlineStoreUrl: null })])[0].online).toBe(false);
    expect(toProductRows([product({ variants: { nodes: [variant({ availableForSale: false })], pageInfo: { hasNextPage: false } } })])[0].online).toBe(false);
  });
  it("uses the variant photo, then the product's, sized for the shop", () => {
    const own = variant({ media: { nodes: [{ preview: { image: { url: "https://cdn.shopify.com/v.jpg" } } }] } });
    expect(toProductRows([product({ variants: { nodes: [own], pageInfo: { hasNextPage: false } } })])[0].image_url).toBe("https://cdn.shopify.com/v.jpg?width=800");
    expect(toProductRows([product()])[0].image_url).toBe("https://cdn.shopify.com/e.jpg?width=800");
    expect(toProductRows([product({ featuredMedia: null })])[0].image_url).toBeNull();
  });
  it("takes the category from the collection and plain text from the description", () => {
    const [r] = toProductRows([product()]);
    expect(r.category).toBe("Plant milks, cheese & eggs");
    expect(r.description).toBe("Pasture raised.");
  });
});
