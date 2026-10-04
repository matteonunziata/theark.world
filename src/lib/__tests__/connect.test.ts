import { describe, expect, it } from "vitest";
import { reason, suggestions } from "@/lib/connect";

const p = (id: string, city: string | null, interests: string[], open = true) => ({
  id, name: id, tier: "standard", city_id: city, bio: null, interests, instagram: null,
  open_to_connect: open, is_me: false,
});

describe("suggestions", () => {
  const me = { id: "me", interests: ["Yoga", "surfing"] };
  const people = [
    p("far-match", "lisbon", ["yoga", "surfing"]),
    p("near-nomatch", "st", ["chess"]),
    p("near-match", "st", ["surfing"]),
    p("closed", "st", ["yoga"], false),
    p("nothing", "lisbon", ["chess"]),
  ];
  it("ranks same city and shared interests, skips people closed to connecting", () => {
    const s = suggestions(people, me, "st").map((x) => x.p.id);
    expect(s).toEqual(["near-match", "far-match", "near-nomatch"]);
  });
  it("explains why", () => {
    const [first] = suggestions(people, me, "st");
    expect(reason(first, "Santa Teresa")).toBe("Both into surfing, also in Santa Teresa");
  });
});
