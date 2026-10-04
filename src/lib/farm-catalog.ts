// The online farm shop (thearkfarm.shop) runs on Shopify. Its public
// products.json feed is the source for the catalog: one product row per
// size or flavour, so each can carry its own price and stock.

export const SHOP_URL = "https://thearkfarm.shop";

export type ShopifyVariant = {
  id: number;
  title: string;
  price: string;
  available: boolean;
};

export type ShopifyProduct = {
  id: number;
  title: string;
  handle: string;
  body_html: string | null;
  variants: ShopifyVariant[];
  images: { src: string; variant_ids: number[] }[];
};

export type CatalogRow = {
  external_id: string;
  name: string;
  product_group: string;
  variant: string | null;
  category: string;
  price: number;
  online: boolean;
  image_url: string | null;
  description: string | null;
  web_url: string;
};

/** Online shop collection handle → our category. */
const COLLECTIONS: Record<string, string> = {
  "fruits-and-vegetables": "Fruit & vegetables",
  "dried-and-fresh-herbs": "Herbs",
  "plant-milks": "Plant milks, cheese & eggs",
  "sodas-and-iced-teas": "Sodas & iced teas",
  "coffee-and-cold-brew": "Coffee & cold brew",
  "pantry-and-snacks": "Snacks",
  "natural-supplements": "Supplements",
  "cleaning-products": "Cleaning",
  lifestyle: "Lifestyle",
};
export const COLLECTION_HANDLES = Object.keys(COLLECTIONS);

const PRODUCE = /\b(kale|spinach|lettuce|greens|cucumbers?|tomato|bok|fruit)\b/i;

export function categoryFor(
  handle: string,
  title: string,
  collections: Record<string, string[]>,
) {
  for (const [c, handles] of Object.entries(collections)) {
    if (handles.includes(handle) && COLLECTIONS[c]) return COLLECTIONS[c];
  }
  // Ferments, sauces and dips aren't in a collection online.
  return PRODUCE.test(title) && !/pickled/i.test(title)
    ? "Fruit & vegetables"
    : "Pantry";
}

export function plainText(html: string | null | undefined) {
  if (!html) return null;
  const text = html
    .replace(/<(br|\/p|\/li|\/h\d)\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;/g, "’")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
  return text || null;
}

const sized = (src: string) =>
  src + (src.includes("?") ? "&" : "?") + "width=800";

export function toRows(
  products: ShopifyProduct[],
  collections: Record<string, string[]>,
): CatalogRow[] {
  return products.flatMap((p) => {
    const category = categoryFor(p.handle, p.title, collections);
    const description = plainText(p.body_html);
    const title = p.title.replace(/\s+/g, " ").trim();
    return p.variants.map((v) => {
      const variant = v.title === "Default Title" ? null : v.title;
      const img =
        p.images.find((i) => i.variant_ids.includes(v.id)) ?? p.images[0];
      return {
        external_id: String(v.id),
        name: variant ? `${title} · ${variant}` : title,
        product_group: title,
        variant,
        category,
        price: Number(v.price),
        online: v.available,
        image_url: img ? sized(img.src) : null,
        description,
        web_url: `${SHOP_URL}/products/${p.handle}`,
      };
    });
  });
}

/** Fetch the whole online catalog (products plus which collection each is in). */
export async function fetchCatalog(): Promise<CatalogRow[]> {
  const get = async (path: string) => {
    const res = await fetch(`${SHOP_URL}${path}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`${path}: ${res.status}`);
    return (await res.json()) as { products: ShopifyProduct[] };
  };
  const [{ products }, ...cols] = await Promise.all([
    get("/products.json?limit=250"),
    ...COLLECTION_HANDLES.map((h) =>
      get(`/collections/${h}/products.json?limit=250`),
    ),
  ]);
  const collections = Object.fromEntries(
    COLLECTION_HANDLES.map((h, i) => [h, cols[i].products.map((p) => p.handle)]),
  );
  return toRows(products, collections);
}
