import { categoryFor, plainText, SHOP_URL } from "@/lib/farm-catalog";

/** Shape of a product page from the Admin API (see PRODUCT_FIELDS in shopify.ts). */
export type ProductNode = {
  id: string;
  title: string;
  handle: string;
  status: "ACTIVE" | "ARCHIVED" | "DRAFT";
  descriptionHtml: string | null;
  onlineStoreUrl: string | null;
  featuredMedia: { preview: { image: { url: string } | null } | null } | null;
  collections: { nodes: { handle: string }[] };
  variants: {
    nodes: VariantNode[];
    pageInfo: { hasNextPage: boolean };
  };
};

export type VariantNode = {
  id: string;
  title: string;
  price: string;
  sku: string | null;
  barcode: string | null;
  inventoryQuantity: number | null;
  availableForSale: boolean;
  media: { nodes: { preview: { image: { url: string } | null } | null }[] };
};

export type ProductRow = {
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
  sku: string | null;
  barcode: string | null;
  shopify_status: ProductNode["status"];
  shopify_stock: number | null;
  shopify_product_id: string;
};

/** "gid://shopify/ProductVariant/123" → "123" */
export const numericId = (gid: string) => gid.split("/").pop() ?? gid;

const sized = (src: string) => src + (src.includes("?") ? "&" : "?") + "width=800";

/**
 * One row per variant, like the website feed, so each size or flavour has its
 * own price and stock. A product is for sale online only while it is active,
 * published to the online store, and the variant can be bought.
 */
export function toProductRows(products: ProductNode[]): ProductRow[] {
  return products.flatMap((p) => {
    const title = p.title.replace(/\s+/g, " ").trim();
    const category = categoryFor(p.handle, title, Object.fromEntries(p.collections.nodes.map((c) => [c.handle, [p.handle]])));
    const description = plainText(p.descriptionHtml);
    const productImage = p.featuredMedia?.preview?.image?.url ?? null;
    return p.variants.nodes.map((v) => {
      const variant = v.title === "Default Title" ? null : v.title;
      const img = v.media.nodes[0]?.preview?.image?.url ?? productImage;
      return {
        external_id: numericId(v.id),
        name: variant ? `${title} · ${variant}` : title,
        product_group: title,
        variant,
        category,
        price: Number(v.price),
        online: p.status === "ACTIVE" && p.onlineStoreUrl !== null && v.availableForSale,
        image_url: img ? sized(img) : null,
        description,
        web_url: `${SHOP_URL}/products/${p.handle}`,
        sku: v.sku?.trim() || null,
        barcode: v.barcode?.trim() || null,
        shopify_status: p.status,
        shopify_stock: v.inventoryQuantity,
        shopify_product_id: numericId(p.id),
      };
    });
  });
}
