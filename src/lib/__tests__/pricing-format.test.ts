import { describe, expect, it } from "vitest";
import { tierPrice } from "@/lib/crm";
import { textToHtml, textToPlain } from "@/lib/email-template";

describe("tier prices", () => {
  const quarter = { price: 340000, price_ff: 270000, currency: "CRC", period: "quarter" };
  it("shows the rack rate by default and the F&F rate when asked", () => {
    expect(tierPrice(quarter)).toBe("₡340,000 for 3 months");
    expect(tierPrice(quarter, null, "ff")).toBe("₡270,000 for 3 months");
  });
  it("falls back to rack when there's no F&F price", () => {
    expect(tierPrice({ price: 20000, price_ff: null, currency: "CRC", period: "day" }, null, "ff")).toBe("₡20,000 a day");
  });
  it("applies a discount on top of the rate", () => {
    expect(tierPrice({ price: 130000, price_ff: 100000, currency: "CRC", period: "month" }, 30, "ff")).toBe("₡70,000 a month");
  });
});

describe("workflow message format", () => {
  const msg = [
    "Hi {{first_name}},",
    "## This week",
    "- Sunrise yoga\n- **Farm** dinner",
    "![The farm](https://x.supabase.co/storage/v1/object/public/email/a.jpg)",
    "[[See the schedule|https://theark.world/portal/schedule]]",
  ].join("\n\n");

  it("renders headings, lists, images and buttons", () => {
    const html = textToHtml(msg);
    expect(html).toContain(">This week</h2>");
    expect(html).toContain("<li");
    expect(html).toContain("<b>Farm</b>");
    expect(html).toContain('<img src="https://x.supabase.co/storage/v1/object/public/email/a.jpg"');
    expect(html).toContain('href="https://theark.world/portal/schedule"');
  });

  it("refuses images and buttons that aren't https links", () => {
    const html = textToHtml('![x](javascript:alert(1))\n\n[[Go|http://evil.test" onclick="x]]');
    expect(html).not.toContain("<img");
    expect(html).not.toContain("onclick=\"x\"");
  });

  it("turns the marks into plain text for WhatsApp and the text part", () => {
    const plain = textToPlain(msg);
    expect(plain).toContain("This week");
    expect(plain).not.toContain("##");
    expect(plain).toContain("See the schedule: https://theark.world/portal/schedule");
    expect(plain).toContain("Farm dinner");
  });
});
