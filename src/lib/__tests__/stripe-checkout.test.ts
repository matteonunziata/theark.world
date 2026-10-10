import { describe, expect, it, vi } from "vitest";

// stripe.ts is server-only; the parameter builder is pure, so load it with that guard stubbed.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/email", () => ({}));
vi.mock("@/lib/slack", () => ({}));
vi.mock("@/lib/slack-format", () => ({}));
vi.mock("@/lib/portal-welcome", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({}));
vi.mock("@/lib/shop-order", () => ({}));
vi.mock("@/lib/shopify", () => ({}));
vi.mock("@/lib/crm", () => ({ ratePrice: () => 0 }));

const base = {
  kind: "ticket" as const,
  title: "Farm to Table Dinner, Fri, Oct 16",
  meta: { registration_id: "r1", token: "t1", held: null },
  cancelPath: "/t/t1",
};

describe("checkout params", () => {
  it("charges an amount in minor units, in the ticket's currency", async () => {
    const { checkoutParams } = await import("@/lib/stripe");
    const p = checkoutParams({ ...base, amount: 60000, currency: "CRC", email: "a@b.co", description: "2 × Reservation" });
    expect(p.line_items[0]).toMatchObject({ quantity: 1, price_data: { currency: "crc", unit_amount: 6000000 } });
    expect(p.customer_email).toBe("a@b.co");
    expect(p.metadata).toEqual({ kind: "ticket", registration_id: "r1", token: "t1" });
  });
  it("uses a Stripe price when there is one", async () => {
    const { checkoutParams } = await import("@/lib/stripe");
    expect(checkoutParams({ ...base, priceId: "price_123" }).line_items[0]).toEqual({ quantity: 1, price: "price_123" });
  });
  it("refuses to charge nothing", async () => {
    const { checkoutParams } = await import("@/lib/stripe");
    expect(() => checkoutParams({ ...base })).toThrow("Nothing to charge.");
  });
});
