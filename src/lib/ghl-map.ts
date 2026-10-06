// How an ARK OS contact looks in GoHighLevel and back. Pure functions, no
// network, so they're easy to test. The server side is in ghl.ts.

/** The ARK OS fields that travel to GHL. */
export type ContactOut = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  tier: string | null;
  membership_status: string;
  stages?: { pipeline: string; stage: string }[];
};

/** A GHL contact, from a webhook or the API, in the shape we care about. */
export type ContactIn = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  tags: string[];
  source: string | null;
  updatedAt: string | null;
};

/** Tags ARK OS owns start with this; other tags in GHL are left alone. */
export const ARK_TAG_PREFIX = "ark:";

export function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/** The ark: tags a contact should carry in GHL right now. */
export function arkTags(c: ContactOut, tag: string): string[] {
  const tags = [tag.trim()];
  if (c.tier) {
    tags.push(`${ARK_TAG_PREFIX}tier:${c.tier}`);
    if (c.membership_status === "active") tags.push(`${ARK_TAG_PREFIX}member`);
    else tags.push(`${ARK_TAG_PREFIX}${c.membership_status}`);
  }
  for (const s of c.stages ?? []) {
    tags.push(`${ARK_TAG_PREFIX}${s.pipeline}:${s.stage}`);
  }
  return Array.from(new Set(tags.filter(Boolean)));
}

/** Which tags to add and which of ours to drop, given what GHL has now. */
export function tagChanges(current: string[], wanted: string[]) {
  const have = new Set(current.map((t) => t.toLowerCase()));
  const want = new Set(wanted.map((t) => t.toLowerCase()));
  return {
    add: wanted.filter((t) => !have.has(t.toLowerCase())),
    remove: current.filter(
      (t) => t.toLowerCase().startsWith(ARK_TAG_PREFIX) && !want.has(t.toLowerCase()),
    ),
  };
}

/** The body for POST /contacts/upsert. Tags are handled separately so GHL's own tags survive. */
export function toGhlContact(c: ContactOut, locationId: string) {
  const { firstName, lastName } = splitName(c.name);
  return {
    locationId,
    ...(c.email ? { email: c.email } : {}),
    ...(c.phone ? { phone: c.phone } : {}),
    firstName,
    lastName,
    name: c.name.trim(),
    source: c.source ?? "ARK OS",
  };
}

/** Can this contact be matched in GHL at all? */
export const canPush = (c: Pick<ContactOut, "email" | "phone">) => !!(c.email || c.phone);

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

const pick = (o: Record<string, unknown>, ...keys: string[]) => {
  for (const k of keys) {
    const v = str(o[k]);
    if (v) return v;
  }
  return null;
};

/**
 * Read a GHL contact from whatever shape it arrives in: the API
 * (camelCase), a workflow webhook (snake_case, tags as a comma list), or a
 * body someone mapped by hand in a custom webhook. Returns null if there's
 * no contact id to go on.
 */
export function parseGhlContact(body: unknown): ContactIn | null {
  if (!body || typeof body !== "object") return null;
  let o = body as Record<string, unknown>;
  // Some payloads nest the contact.
  if (o.contact && typeof o.contact === "object" && !str(o.id) && !str(o.contact_id)) {
    o = { ...(o.contact as Record<string, unknown>), ...o };
  }
  const id = pick(o, "id", "contact_id", "contactId");
  if (!id) return null;

  const first = pick(o, "firstName", "first_name", "firstNameRaw", "firstNameLowerCase");
  const last = pick(o, "lastName", "last_name", "lastNameRaw", "lastNameLowerCase");
  const name =
    pick(o, "name", "full_name", "contactName", "fullName") ??
    (first || last ? [first, last].filter(Boolean).join(" ") : null);

  const rawTags = o.tags;
  const tags = Array.isArray(rawTags)
    ? rawTags.map((t) => str(t)).filter((t): t is string => !!t)
    : typeof rawTags === "string"
      ? rawTags.split(",").map((t) => t.trim()).filter(Boolean)
      : [];

  return {
    id,
    name,
    email: pick(o, "email")?.toLowerCase() ?? null,
    phone: pick(o, "phone"),
    tags,
    source: pick(o, "source", "contact_source"),
    updatedAt: pick(o, "dateUpdated", "date_updated", "updatedAt"),
  };
}

/** Is this a "contact was deleted" notice? We never delete on those. */
export function isDeleteNotice(body: unknown) {
  if (!body || typeof body !== "object") return false;
  const t = str((body as Record<string, unknown>).type);
  return !!t && /delete/i.test(t);
}
