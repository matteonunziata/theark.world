import { describe, expect, it } from "vitest";
import {
  arkTags,
  canPush,
  isDeleteNotice,
  parseGhlContact,
  splitName,
  tagChanges,
  toGhlContact,
} from "../ghl-map";

const base = {
  id: "c1",
  name: "Ana María Rojas",
  email: "ana@example.com",
  phone: "+50688880000",
  source: "Instagram",
  tier: "standard",
  membership_status: "active",
};

describe("names", () => {
  it("splits first and the rest", () => {
    expect(splitName("Ana María Rojas")).toEqual({ firstName: "Ana", lastName: "María Rojas" });
    expect(splitName("  Solo ")).toEqual({ firstName: "Solo", lastName: "" });
    expect(splitName("")).toEqual({ firstName: "", lastName: "" });
  });
});

describe("tags", () => {
  it("marks members, tiers and pipeline stages", () => {
    expect(arkTags({ ...base, stages: [{ pipeline: "memberships", stage: "active" }] }, "ark-os"))
      .toEqual(["ark-os", "ark:tier:standard", "ark:member", "ark:memberships:active"]);
  });
  it("marks paused members as paused, not member", () => {
    expect(arkTags({ ...base, membership_status: "paused" }, "ark-os"))
      .toEqual(["ark-os", "ark:tier:standard", "ark:paused"]);
  });
  it("gives plain contacts only the base tag", () => {
    expect(arkTags({ ...base, tier: null }, " The ARK ")).toEqual(["The ARK"]);
  });
  it("adds what's missing and drops only stale ark: tags", () => {
    const r = tagChanges(["VIP", "ark:member", "ARK-OS"], ["ark-os", "ark:tier:founding"]);
    expect(r.add).toEqual(["ark:tier:founding"]);
    expect(r.remove).toEqual(["ark:member"]);
  });
});

describe("outbound body", () => {
  it("builds the upsert body without tags", () => {
    expect(toGhlContact(base, "loc1")).toEqual({
      locationId: "loc1",
      email: "ana@example.com",
      phone: "+50688880000",
      firstName: "Ana",
      lastName: "María Rojas",
      name: "Ana María Rojas",
      source: "Instagram",
    });
  });
  it("leaves out empty email and phone", () => {
    const b = toGhlContact({ ...base, email: null, phone: null, source: null }, "loc1");
    expect(b).not.toHaveProperty("email");
    expect(b).not.toHaveProperty("phone");
    expect(b.source).toBe("ARK OS");
  });
  it("needs an email or a phone to match on", () => {
    expect(canPush({ email: null, phone: null })).toBe(false);
    expect(canPush({ email: null, phone: "+506" })).toBe(true);
  });
});

describe("inbound parsing", () => {
  it("reads the API shape", () => {
    expect(
      parseGhlContact({
        id: "g1",
        firstName: "Ana",
        lastName: "Rojas",
        email: "Ana@Example.com",
        phone: "+506",
        tags: ["vip", "ark-os"],
        source: "Facebook",
        dateUpdated: "2026-10-05T10:00:00.000Z",
      }),
    ).toEqual({
      id: "g1",
      name: "Ana Rojas",
      email: "ana@example.com",
      phone: "+506",
      tags: ["vip", "ark-os"],
      source: "Facebook",
      updatedAt: "2026-10-05T10:00:00.000Z",
    });
  });
  it("reads a workflow webhook (snake case, tags as a list)", () => {
    const c = parseGhlContact({
      contact_id: "g2",
      first_name: "Luis",
      last_name: "",
      full_name: "Luis Mora",
      email: "luis@example.com",
      phone: "",
      tags: "new lead, ark-os",
      contact_source: "website",
    });
    expect(c).toMatchObject({ id: "g2", name: "Luis Mora", phone: null, tags: ["new lead", "ark-os"], source: "website" });
  });
  it("reads a nested contact", () => {
    expect(parseGhlContact({ event: "x", contact: { id: "g3", name: "Nest", email: "n@example.com" } }))
      .toMatchObject({ id: "g3", name: "Nest", email: "n@example.com" });
  });
  it("rejects bodies without an id", () => {
    expect(parseGhlContact({ email: "x@example.com" })).toBeNull();
    expect(parseGhlContact("nope")).toBeNull();
  });
  it("spots delete notices", () => {
    expect(isDeleteNotice({ type: "ContactDelete", id: "g1" })).toBe(true);
    expect(isDeleteNotice({ type: "ContactCreate" })).toBe(false);
  });
});
