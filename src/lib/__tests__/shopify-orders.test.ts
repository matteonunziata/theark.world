import { describe, expect, it } from "vitest";
import { contactName, methodFor, numericId, type OrderNode, optedOutOfMarketing, toRecord } from "@/lib/shopify-orders-map";

const order = (over: Partial<OrderNode> = {}): OrderNode => ({
  id: "gid://shopify/Order/1",
  name: "#1001",
  email: "Ana@Example.com ",
  createdAt: "2026-10-07T15:00:00Z",
  updatedAt: "2026-10-07T15:01:00Z",
  cancelledAt: null,
  displayFinancialStatus: "PAID",
  tags: [],
  currencyCode: "CRC",
  paymentGatewayNames: ["shopify_payments"],
  totalPriceSet: { shopMoney: { amount: "5000.00" } },
  customer: { id: "gid://shopify/Customer/9", firstName: "Ana", lastName: "Lopez", email: "ana@example.com", emailMarketingConsent: null },
  lineItems: {
    nodes: [
      { quantity: 2, title: "Kale", variant: { id: "gid://shopify/ProductVariant/111" }, discountedTotalSet: { shopMoney: { amount: "3000.00" } } },
      { quantity: 1, title: "Tip", variant: null, discountedTotalSet: { shopMoney: { amount: "500.00" } } },
    ],
  },
  ...over,
});

describe("numericId", () => {
  it("takes the number off a Shopify gid", () => {
    expect(numericId("gid://shopify/ProductVariant/123")).toBe("123");
    expect(numericId(null)).toBe("");
  });
});

describe("methodFor", () => {
  it("maps gateways to the ledger's methods", () => {
    expect(methodFor(["shopify_payments"])).toBe("card");
    expect(methodFor(["SINPE Móvil"])).toBe("sinpe");
    expect(methodFor(["Cash on Delivery (COD)"])).toBe("cash");
    expect(methodFor(["Bank Deposit"])).toBe("transfer");
    expect(methodFor(["manual"])).toBe("other");
    expect(methodFor([])).toBe("card");
  });
});

describe("toRecord", () => {
  it("works out unit prices after line discounts and drops lines with no variant", () => {
    const r = toRecord(order());
    expect(r.lines).toEqual([{ variant: "111", title: "Kale", qty: 2, unit: 1500, amount: 3000 }]);
    expect(r.total).toBe(5000);
    expect(r.email).toBe("ana@example.com");
    expect(r.portal).toBe(false);
    expect(r.method).toBe("card");
  });
  it("marks portal orders so they aren't counted twice", () => {
    expect(toRecord(order({ tags: ["ark-portal", "pickup"] })).portal).toBe(true);
  });
  it("falls back to the customer's email and carries the status and cancellation", () => {
    const r = toRecord(order({ email: null, displayFinancialStatus: "REFUNDED", cancelledAt: "2026-10-08T00:00:00Z" }));
    expect(r.email).toBe("ana@example.com");
    expect(r.status).toBe("REFUNDED");
    expect(r.cancelled_at).toBe("2026-10-08T00:00:00Z");
  });
});

describe("contactName", () => {
  it("prefers the customer's name, then the email", () => {
    expect(contactName(order())).toBe("Ana Lopez");
    expect(contactName(order({ customer: null }))).toBe("Ana@Example.com ".split("@")[0]);
    expect(contactName(order({ customer: null, email: null }))).toBe("Shop customer");
  });
});

describe("optedOutOfMarketing", () => {
  it("only subscribed customers may be mailed", () => {
    expect(optedOutOfMarketing(order())).toBe(true);
    const c = order().customer!;
    expect(optedOutOfMarketing(order({ customer: { ...c, emailMarketingConsent: { marketingState: "SUBSCRIBED" } } }))).toBe(false);
    expect(optedOutOfMarketing(order({ customer: { ...c, emailMarketingConsent: { marketingState: "NOT_SUBSCRIBED" } } }))).toBe(true);
  });
});
