export const CATEGORIES = [
  "Vegetables",
  "Fruit",
  "Eggs & dairy",
  "Pantry",
  "Drinks",
  "Bakery",
  "Body & home",
  "Other",
];

export const lowState = (p: { stock: number; low_at: number }) =>
  Number(p.stock) <= 0 ? "out" : Number(p.stock) <= Number(p.low_at) ? "low" : "";

export const fmtMoney = (n: number | null | undefined, cur = "CRC") => {
  const v = Math.round(Number(n || 0));
  const s = Math.abs(v).toLocaleString("en-US");
  return (v < 0 ? "−" : "") + (cur === "USD" ? "$" : "₡") + s;
};
