// Categories follow the online shop's collections (thearkfarm.shop).
export const CATEGORIES = [
  "Fruit & vegetables",
  "Herbs",
  "Plant milks, cheese & eggs",
  "Pantry",
  "Snacks",
  "Sodas & iced teas",
  "Coffee & cold brew",
  "Supplements",
  "Cleaning",
  "Lifestyle",
  "Other",
];

/** Low-stock state; products nobody is counting never raise an alert. */
export const lowState = (p: {
  stock: number;
  low_at: number;
  track_stock?: boolean;
}) =>
  p.track_stock === false
    ? ""
    : Number(p.stock) <= 0
      ? "out"
      : Number(p.stock) <= Number(p.low_at)
        ? "low"
        : "";

export const productImage = (p: {
  image_path: string | null;
  image_url: string | null;
}) =>
  p.image_path
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/products/${p.image_path}`
    : p.image_url;

export const fmtMoney = (n: number | null | undefined, cur = "CRC") => {
  const v = Math.round(Number(n || 0));
  const s = Math.abs(v).toLocaleString("en-US");
  return (v < 0 ? "−" : "") + (cur === "USD" ? "$" : "₡") + s;
};

/** How a sale was paid, at the till. */
export const SHOP_METHODS = [
  ["cash", "Cash"],
  ["sinpe", "SINPE Móvil"],
  ["card", "Card"],
  ["transfer", "Bank transfer"],
  ["other", "Other"],
] as const;
export type ShopMethod = (typeof SHOP_METHODS)[number][0];
export const shopMethodName = (k: string | null | undefined) =>
  SHOP_METHODS.find((m) => m[0] === k)?.[1] ?? "Not noted";

/** "₡1.2M", "₡850k", "₡640": money where there's no room for digits. */
export const fmtCompact = (n: number | null | undefined, cur = "CRC") => {
  const v = Math.abs(Number(n || 0));
  const trim = (s: string) => s.replace(/\.0$/, "");
  const s =
    v >= 1e6
      ? `${trim((v / 1e6).toFixed(v >= 1e7 ? 0 : 1))}M`
      : v >= 1e3
        ? `${trim((v / 1e3).toFixed(v >= 1e5 ? 0 : 1))}k`
        : String(Math.round(v));
  return (Number(n) < 0 ? "−" : "") + (cur === "USD" ? "$" : "₡") + s;
};
