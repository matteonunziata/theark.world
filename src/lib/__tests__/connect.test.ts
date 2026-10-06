import { describe, expect, it } from "vitest";
import { reason, splitList, suggestions } from "@/lib/connect";

const p = (id: string, cities: string[], interests: string[], open = true) => ({
  id, name: id, tier: "standard", city_id: null, cities, bio: null, interests, instagram: null,
  phone: null, photo_path: null, open_to_connect: open, is_me: false,
});

describe("suggestions", () => {
  const me = { id: "me", interests: ["Yoga", "surfing"], cities: ["Santa Teresa"] };
  const people = [
    p("far-match", ["Lisbon"], ["yoga", "surfing"]),
    p("near-nomatch", ["santa teresa"], ["chess"]),
    p("near-match", ["Santa Teresa", "Berlin"], ["surfing"]),
    p("closed", ["Santa Teresa"], ["yoga"], false),
    p("nothing", ["Lisbon"], ["chess"]),
  ];
  it("ranks shared cities and shared interests, skips people closed to connecting", () => {
    const s = suggestions(people, me).map((x) => x.p.id);
    expect(s).toEqual(["near-match", "far-match", "near-nomatch"]);
  });
  it("explains why", () => {
    const [first] = suggestions(people, me);
    expect(reason(first)).toBe("Both into surfing, both spend time in Santa Teresa");
  });
});

describe("splitList", () => {
  it("trims, drops blanks and caps the list", () => {
    expect(splitList(" Santa Teresa, Lisbon ,, NYC ")).toEqual(["Santa Teresa", "Lisbon", "NYC"]);
    expect(splitList("a,b,c", 2)).toEqual(["a", "b"]);
    expect(splitList(null)).toEqual([]);
  });
});
