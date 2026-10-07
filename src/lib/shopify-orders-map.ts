// Pure parts of the Shopify order import: what Shopify's order looks like,
// and how it becomes the payload record_shopify_order() takes.

export type OrderNode = {
  id: string;
  name: string;
  email: string | null;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  displayFinancialStatus: string | null;
  tags: string[];
  currencyCode: string;
  paymentGatewayNames: string[];
  totalPriceSet: { shopMoney: { amount: string } };
  customer: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    emailMarketingConsent: { marketingState: string } | null;
  } | null;
  lineItems: {
    nodes: {
      quantity: number;
      title: string;
      variant: { id: string } | null;
      discountedTotalSet: { shopMoney: { amount: string } };
    }[];
  };
};

export type OrderLine = { variant: string; title: string; qty: number; unit: number; amount: number };

export type OrderRecord = {
  shopify_id: string;
  name: string;
  email: string | null;
  currency: string;
  total: number;
  status: string;
  cancelled_at: string | null;
  ordered_at: string;
  tags: string[];
  portal: boolean;
  method: "cash" | "card" | "sinpe" | "transfer" | "other";
  lines: OrderLine[];
};

/** Orders made in the member portal carry this tag (see pushOrder). */
export const PORTAL_TAG = "ark-portal";

/** gid://shopify/ProductVariant/123 → "123", the id the catalog stores. */
export const numericId = (gid: string | null | undefined) => (gid ?? "").split("/").pop() ?? "";

/** The ledger's payment methods are few; map what Shopify says to the nearest. */
export function methodFor(gateways: string[]): OrderRecord["method"] {
  const g = gateways.join(" ").toLowerCase();
  if (/sinpe/.test(g)) return "sinpe";
  if (/cash|cod\b|efectivo/.test(g)) return "cash";
  if (/bank|transfer|deposit|transferencia/.test(g)) return "transfer";
  if (/manual|custom/.test(g)) return "other";
  return "card";
}

const money = (v: string | number | null | undefined) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

export function toRecord(o: OrderNode): OrderRecord {
  const lines = o.lineItems.nodes.flatMap<OrderLine>((l) => {
    const variant = numericId(l.variant?.id);
    const qty = Math.trunc(l.quantity);
    // Custom items and deleted variants have no catalog product.
    if (!variant || qty <= 0) return [];
    const amount = round2(money(l.discountedTotalSet.shopMoney.amount));
    return [{ variant, title: l.title, qty, unit: round2(amount / qty), amount }];
  });
  return {
    shopify_id: o.id,
    name: o.name,
    email: (o.email ?? o.customer?.email ?? null)?.trim().toLowerCase() || null,
    currency: o.currencyCode,
    total: round2(money(o.totalPriceSet.shopMoney.amount)),
    status: o.displayFinancialStatus ?? "PENDING",
    cancelled_at: o.cancelledAt,
    ordered_at: o.createdAt,
    tags: o.tags,
    portal: o.tags.includes(PORTAL_TAG),
    method: methodFor(o.paymentGatewayNames),
    lines,
  };
}

/** A name for a contact made from an order: the customer's, else the email's local part. */
export function contactName(o: OrderNode): string {
  const full = `${o.customer?.firstName ?? ""} ${o.customer?.lastName ?? ""}`.replace(/\s+/g, " ").trim();
  if (full) return full;
  const email = o.email ?? o.customer?.email ?? "";
  return email.split("@")[0] || "Shop customer";
}

/** Only a customer who opted in to Shopify's marketing may be mailed by ARK OS. */
export const optedOutOfMarketing = (o: OrderNode) => o.customer?.emailMarketingConsent?.marketingState !== "SUBSCRIBED";
