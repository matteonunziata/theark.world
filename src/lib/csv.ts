/** Most people one import takes (keeps the request under the 1MB action limit). */
export const IMPORT_MAX = 2000;

/** Parse CSV text (RFC 4180: quoted fields, "" escapes, newlines in quotes). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  // Spreadsheets in some locales export with semicolons.
  const firstLine = src.slice(0, src.search(/\r?\n|$/));
  const sep =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0)
      ? ";"
      : (firstLine.match(/\t/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0)
        ? "\t"
        : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export type ImportField =
  | "name"
  | "first_name"
  | "last_name"
  | "email"
  | "phone"
  | "instagram"
  | "location"
  | "source"
  | "interests"
  | "type"
  | "note";

/** Header names we recognise, after lowercasing and dropping punctuation. */
const ALIASES: Record<ImportField, string[]> = {
  name: ["name", "full name", "fullname", "contact name", "contact"],
  first_name: ["first name", "firstname", "first", "given name"],
  last_name: ["last name", "lastname", "last", "surname", "family name"],
  email: ["email", "email address", "e mail", "mail"],
  phone: ["phone", "phone number", "mobile", "cell", "whatsapp", "whatsapp number", "telephone", "tel"],
  instagram: ["instagram", "ig", "instagram handle"],
  location: ["location", "city", "country", "where", "based in"],
  source: ["source", "lead source", "how did you hear", "how did you hear about us", "referral", "channel"],
  interests: ["interests", "tags", "interest", "labels"],
  type: ["type", "contact type", "kind"],
  note: ["note", "notes", "comment", "comments", "description"],
};

export const FIELD_LABELS: Record<ImportField, string> = {
  name: "Name",
  first_name: "First name",
  last_name: "Last name",
  email: "Email",
  phone: "Phone",
  instagram: "Instagram",
  location: "Location",
  source: "Source",
  interests: "Interests",
  type: "Type",
  note: "Note",
};

const norm = (h: string) =>
  h
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Which field each column feeds, or null to ignore it. */
export function mapHeaders(headers: string[]): (ImportField | null)[] {
  const used = new Set<ImportField>();
  return headers.map((h) => {
    const n = norm(h);
    const f = (Object.keys(ALIASES) as ImportField[]).find(
      (k) => !used.has(k) && (ALIASES[k].includes(n) || (k === "source" && n.startsWith("how did you hear"))),
    );
    if (!f) return null;
    used.add(f);
    return f;
  });
}

export type ImportRow = {
  name: string;
  email: string | null;
  phone: string | null;
  instagram: string | null;
  location: string | null;
  source: string | null;
  interests: string[];
  type: string | null;
  note: string | null;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TYPES: Record<string, string> = {
  contact: "contact",
  lead: "contact",
  member: "member",
  steward: "steward",
  landowner: "steward",
  owner: "steward",
};

/** Turn parsed rows into contacts, with a reason for any row we can't use. */
export function toContacts(rows: string[][]) {
  const [headers = [], ...body] = rows;
  const map = mapHeaders(headers);
  const ok: ImportRow[] = [];
  const problems: { line: number; reason: string }[] = [];
  const seen = new Set<string>();

  body.forEach((cells, i) => {
    const line = i + 2; // 1-based, after the header
    const get = (f: ImportField) => {
      const idx = map.indexOf(f);
      const v = idx < 0 ? "" : (cells[idx] ?? "").trim();
      return v === "" ? null : v;
    };
    const name =
      get("name") ??
      ([get("first_name"), get("last_name")].filter(Boolean).join(" ") || null);
    const email = get("email")?.toLowerCase() ?? null;
    if (!name && !email) return problems.push({ line, reason: "No name or email" });
    if (email && !EMAIL.test(email)) return problems.push({ line, reason: `“${email}” isn’t an email` });
    if (email && seen.has(email)) return problems.push({ line, reason: `${email} appears twice in the file` });
    if (email) seen.add(email);
    const ig = get("instagram");
    ok.push({
      name: name ?? email!.split("@")[0],
      email,
      phone: get("phone"),
      instagram: ig ? ig.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/$/, "") : null,
      location: get("location"),
      source: get("source"),
      interests: (get("interests") ?? "")
        .split(/[,;|]/)
        .map((s) => s.trim())
        .filter(Boolean),
      type: TYPES[(get("type") ?? "").toLowerCase()] ?? null,
      note: get("note"),
    });
  });
  return { map, headers, ok, problems };
}
