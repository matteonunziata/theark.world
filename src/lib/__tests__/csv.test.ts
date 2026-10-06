import { describe, expect, it } from "vitest";
import { mapHeaders, parseCsv, toContacts } from "@/lib/csv";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, and newlines inside quotes", () => {
    expect(parseCsv('a,b\n"x, y","say ""hi""\nthere"\r\n')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"\nthere'],
    ]);
  });
  it("detects semicolons and skips blank lines and a BOM", () => {
    expect(parseCsv("﻿name;email\n\nAna;ana@x.com\n")).toEqual([
      ["name", "email"],
      ["Ana", "ana@x.com"],
    ]);
  });
});

describe("mapHeaders", () => {
  it("recognises common header names", () => {
    expect(mapHeaders(["First Name", "Last name", "E-mail", "WhatsApp Number", "Notes", "Shoe size"])).toEqual([
      "first_name",
      "last_name",
      "email",
      "phone",
      "note",
      null,
    ]);
  });
});

describe("toContacts", () => {
  it("joins first and last names, lowercases email, and reports problems", () => {
    const { ok, problems } = toContacts(
      parseCsv(
        [
          "First name,Last name,Email,Tags,Type",
          "Ana,Mora,Ana@Example.com,yoga; surf,member",
          ",,not-an-email,,",
          "Ana,Again,ana@example.com,,",
          ",,,,",
          "Luis,,,,landowner",
        ].join("\n"),
      ),
    );
    expect(ok).toHaveLength(2);
    expect(ok[0]).toMatchObject({ name: "Ana Mora", email: "ana@example.com", interests: ["yoga", "surf"], type: "member" });
    expect(ok[1]).toMatchObject({ name: "Luis", email: null, type: "steward" });
    expect(problems.map((p) => p.line)).toEqual([3, 4]);
  });
});
