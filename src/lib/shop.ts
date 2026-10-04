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
