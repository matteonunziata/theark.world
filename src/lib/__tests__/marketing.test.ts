import { describe, expect, it } from "vitest";
import { crDate, crTime, fromCrLocal, mergeFields, slug, tagLinks, toCrLocal, withUtm } from "@/lib/marketing";

describe("UTM links", () => {
  const utm = { source: "email", medium: "email", campaign: "farm-shop", content: "farm" };

  it("adds tags and keeps existing query params", () => {
    const u = new URL(withUtm("https://theark.world/shop?item=eggs", utm));
    expect(u.searchParams.get("item")).toBe("eggs");
    expect(u.searchParams.get("utm_source")).toBe("email");
    expect(u.searchParams.get("utm_campaign")).toBe("farm-shop");
  });

  it("never overwrites tags that are already there", () => {
    const u = new URL(withUtm("https://theark.world/join?utm_source=instagram", utm));
    expect(u.searchParams.get("utm_source")).toBe("instagram");
    expect(u.searchParams.get("utm_medium")).toBe("email");
  });

  it("leaves non-web links alone", () => {
    expect(withUtm("mailto:hello@theark.world", utm)).toBe("mailto:hello@theark.world");
  });

  it("tags buttons, markdown links and bare links in a message", () => {
    const body = "See [[Order ahead|https://theark.world/shop]] or https://theark.world/join. Also [x](https://a.b/c).";
    const out = tagLinks(body, utm);
    expect(out).toContain("[[Order ahead|https://theark.world/shop?utm_source=email");
    expect(out).toContain("https://theark.world/join?utm_source=email");
    expect(out).toMatch(/\/join\?[^ ]*utm_content=farm\. Also/);
    expect(out).toContain("(https://a.b/c?utm_source=email");
  });
});

describe("Costa Rica time", () => {
  it("round-trips a local time (UTC-6, no daylight saving)", () => {
    const iso = fromCrLocal("2026-10-04T15:30");
    expect(iso).toBe("2026-10-04T21:30:00.000Z");
    expect(toCrLocal(iso)).toBe("2026-10-04T15:30");
  });

  it("puts late-evening posts on the right day", () => {
    expect(crDate("2026-10-05T03:00:00Z")).toBe("2026-10-04");
    expect(crTime("2026-10-05T03:00:00Z")).toBe("9pm");
  });
});

describe("merge fields", () => {
  it("fills names and the application link", () => {
    expect(mergeFields("Hi {{first_name}}, apply: {{application_url}}", { name: "Ana López", application_url: "https://x.y" })).toBe(
      "Hi Ana, apply: https://x.y",
    );
    expect(mergeFields("Hi {{first_name}}", { name: null })).toBe("Hi there");
  });

  it("makes campaign slugs", () => {
    expect(slug("Farm shop opening: Sábado!")).toBe("farm-shop-opening-sabado");
  });
});
