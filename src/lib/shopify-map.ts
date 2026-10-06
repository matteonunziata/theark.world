// Pure parts of the Shopify integration: which discount a member gets, what
// the tags and segments are called, and tidying what staff type in.

export type Level = {
  /** The discount code customers type at checkout. */
  code: "member10" | "member20";
  percent: number;
  /** Customer tag ARK OS puts on Shopify customers at this level. */
  tag: string;
  /** Customer segment (tag-based) the code is limited to. */
  segment: string;
  title: string;
};

// Highest first.
export const LEVELS: Level[] = [
  { code: "member20", percent: 20, tag: "ark-member20", segment: "ARK members 20%", title: "ARK member 20%" },
  { code: "member10", percent: 10, tag: "ark-member10", segment: "ARK members 10%", title: "ARK member 10%" },
];

export const ARK_TAGS = LEVELS.map((l) => l.tag);

/** The code for a tier's discount: 20% or more is member20, 10% or more is member10, else none. */
export function levelForPercent(percent: number | null | undefined): Level | null {
  const p = Number(percent) || 0;
  return LEVELS.find((l) => p >= l.percent) ?? null;
}

export type MembershipRow = {
  status: string;
  starts_on: string | null;
  ends_on: string | null;
  /** From the tier. */
  period: string;
  court_discount: number | null;
};

/**
 * The level a person has on a day (YYYY-MM-DD, Costa Rica): the best of the
 * memberships that cover it. Only paid-up memberships of a month or longer
 * count; passes, paused, ended and not-yet-started ones don't. Cancelled
 * subscriptions run to their end date, like at the gate.
 */
export function levelOn(rows: MembershipRow[], today: string): Level | null {
  let best: Level | null = null;
  for (const m of rows) {
    if (m.period === "day" || m.period === "week") continue;
    if (m.status !== "active" && m.status !== "cancelled") continue;
    if (!m.starts_on || m.starts_on > today) continue;
    if (m.ends_on && m.ends_on < today) continue;
    const l = levelForPercent(m.court_discount);
    if (l && (!best || l.percent > best.percent)) best = l;
  }
  return best;
}

/** "my-store", "my-store.myshopify.com" or the admin URL → "my-store.myshopify.com". */
export function normalizeShop(input: string): string | null {
  let s = input.trim().toLowerCase();
  if (!s) return null;
  const admin = s.match(/admin\.shopify\.com\/store\/([a-z0-9][a-z0-9-]*)/);
  if (admin) return `${admin[1]}.myshopify.com`;
  s = s.replace(/^https?:\/\//, "").replace(/[/?#].*$/, "");
  if (/^[a-z0-9][a-z0-9-]*$/.test(s)) return `${s}.myshopify.com`;
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(s) ? s : null;
}

export const normEmail = (e: string | null | undefined) => (e ?? "").trim().toLowerCase();

export type Plan = {
  /** Email → level they should have. */
  want: Map<string, Level>;
  /** Shopify customers that already carry ARK tags: id, email, tags. */
  have: { id: string; email: string | null; tags: string[] }[];
};

export type Change = { id: string | null; email: string; add: string[]; remove: string[] };

/**
 * What to change in Shopify so the tags match who is a member. Customers
 * already right are left alone; customers carrying ARK tags who shouldn't are
 * stripped of them; members with no customer yet come back with id null.
 */
export function diffTags({ want, have }: Plan): Change[] {
  const out: Change[] = [];
  const seen = new Set<string>();
  for (const c of have) {
    const email = normEmail(c.email);
    const mine = c.tags.filter((t) => ARK_TAGS.includes(t));
    const level = email ? want.get(email) : undefined;
    if (email) seen.add(email);
    const add = level && !mine.includes(level.tag) ? [level.tag] : [];
    const remove = mine.filter((t) => t !== level?.tag);
    if (add.length || remove.length) out.push({ id: c.id, email, add, remove });
  }
  for (const [email, level] of want) {
    if (!seen.has(email)) out.push({ id: null, email, add: [level.tag], remove: [] });
  }
  return out;
}
