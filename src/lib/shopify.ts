import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json, Tables } from "@/lib/database.types";
import { todayIn } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ARK_TAGS,
  diffTags,
  type Level,
  LEVELS,
  levelOn,
  type MembershipRow,
  normEmail,
} from "@/lib/shopify-map";
import { contactName, type OrderNode, optedOutOfMarketing, toRecord } from "@/lib/shopify-orders-map";

// Shopify sync. Who is a member goes out as customer tags (ark-member10,
// ark-member20). The codes member10 and member20 in Shopify are limited to the
// customer segments those tags make up, so a code works only for someone ARK OS
// has tagged, and stops when the tag comes off with the end of the membership.
// ARK OS is the source of truth for the tags; each run compares them with
// Shopify's and fixes the difference, so a tag changed by hand is put right.

type Sb = SupabaseClient<Database>;
export type Integration = Tables<"integrations">;

const API_VERSION = "2026-07";
/** Stop starting new customers after this long, so a run ends inside the cron's limit. */
const BUDGET_MS = 45_000;
/** What the app needs. write_* includes read_*. */
const SCOPES = ["write_customers", "write_discounts", "write_orders", "read_products"];

export class ShopifyError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong talking to Shopify.");
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

export async function logEvent(
  sb: Sb,
  e: {
    direction: "in" | "out";
    kind: "test" | "sync" | "push" | "webhook";
    ok: boolean;
    detail: string;
    contact_id?: string | null;
  },
) {
  await sb.from("integration_events").insert({ provider: "shopify", ...e });
}

export async function getIntegration(sb: Sb) {
  const { data } = await sb.from("integrations").select("*").eq("key", "shopify").maybeSingle();
  return data;
}

export const ready = (i: Integration | null | undefined): i is Integration & { shop_domain: string; secret: string } =>
  !!i && !!i.connected_at && !!i.secret && !!i.shop_domain && i.enabled;

// Access ------------------------------------------------------------------------------

/**
 * Shopify apps made in the Dev Dashboard have a client id and secret and trade
 * them for a 24-hour token; older custom apps hand out a token (shpat_…) that
 * doesn't expire. With a client id saved, the secret is exchanged; without,
 * the secret is the token.
 */
export async function fetchToken(shop: string, clientId: string, secret: string) {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: secret, grant_type: "client_credentials" }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number; error_description?: string } | null;
  if (!res.ok || !json?.access_token) {
    throw new ShopifyError(
      res.status,
      `Shopify didn’t accept the client id and secret${json?.error_description ? ` (${json.error_description})` : ""}. Copy both again from the app’s Settings in the Dev Dashboard, and make sure the app is installed on this store.`,
    );
  }
  const seconds = Number.isFinite(json.expires_in) && json.expires_in ? json.expires_in : 86399;
  return { token: json.access_token, expiresAt: new Date(Date.now() + seconds * 1000).toISOString() };
}

/** A token to use now, refreshed when it's within five minutes of running out. */
async function tokenFor(sb: Sb, i: Integration & { shop_domain: string; secret: string }) {
  if (!i.client_id) return i.secret;
  if (i.access_token && i.token_expires_at && new Date(i.token_expires_at).getTime() - Date.now() > 5 * 60_000) {
    return i.access_token;
  }
  const t = await fetchToken(i.shop_domain, i.client_id, i.secret);
  await sb.from("integrations").update({ access_token: t.token, token_expires_at: t.expiresAt }).eq("key", "shopify");
  return t.token;
}

type Gql = { data?: Record<string, unknown>; errors?: { message: string; extensions?: { code?: string } }[] };

async function graphql<T>(shop: string, token: string, query: string, variables: Record<string, unknown> = {}, retried = false): Promise<T> {
  const res = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token, Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  if (res.status === 401 || res.status === 403) {
    throw new ShopifyError(res.status, "Shopify didn’t accept the token. Check it was copied whole and the app is installed on this store.");
  }
  if (res.status === 404) throw new ShopifyError(404, "Shopify couldn’t find that store. Check the store address.");
  if (res.status === 429 && !retried) {
    await pause(2000);
    return graphql<T>(shop, token, query, variables, true);
  }
  if (!res.ok) throw new ShopifyError(res.status, `Shopify returned ${res.status}.`);
  const json = (await res.json()) as Gql;
  if (json.errors?.length) {
    if (!retried && json.errors.some((e) => e.extensions?.code === "THROTTLED")) {
      await pause(2000);
      return graphql<T>(shop, token, query, variables, true);
    }
    const access = json.errors.find((e) => /access denied|scope/i.test(e.message));
    throw new ShopifyError(
      403,
      access ? `Shopify says this app is missing a permission: ${access.message}` : `Shopify said: ${json.errors[0].message}`,
    );
  }
  return json.data as T;
}

type UserErrors = { field?: string[] | null; message: string }[];
function userErrors(e: UserErrors | null | undefined) {
  if (e?.length) throw new ShopifyError(422, `Shopify said: ${e.map((x) => x.message).join(", ")}`);
}

/** Can we reach the store, and may the app do what it needs? */
export async function testConnection(shop: string, token: string) {
  const d = await graphql<{
    shop: { name: string };
    currentAppInstallation: { accessScopes: { handle: string }[] };
  }>(shop, token, `{ shop { name } currentAppInstallation { accessScopes { handle } } }`);
  const have = new Set(d.currentAppInstallation.accessScopes.map((s) => s.handle));
  const missing = SCOPES.filter((s) => !have.has(s));
  return { name: d.shop.name, missing };
}

// Segments and discount codes ---------------------------------------------------------

type Settings = {
  segments?: Record<string, string>;
  discounts?: Record<string, string>;
  /** Orders updated in Shopify at or after this have been brought in. */
  ordersSince?: string;
};
const settingsOf = (i: Integration): Settings => (i.settings && typeof i.settings === "object" && !Array.isArray(i.settings) ? (i.settings as Settings) : {});

async function ensureSegment(shop: string, token: string, level: Level) {
  const list = await graphql<{ segments: { nodes: { id: string; name: string }[] } }>(
    shop,
    token,
    `{ segments(first: 100) { nodes { id name } } }`,
  );
  const found = list.segments.nodes.find((s) => s.name === level.segment);
  if (found) return found.id;
  const r = await graphql<{ segmentCreate: { segment: { id: string } | null; userErrors: UserErrors } }>(
    shop,
    token,
    `mutation($name: String!, $query: String!) {
      segmentCreate(name: $name, query: $query) { segment { id } userErrors { field message } }
    }`,
    { name: level.segment, query: `customer_tags CONTAINS '${level.tag}'` },
  );
  userErrors(r.segmentCreate.userErrors);
  if (!r.segmentCreate.segment) throw new ShopifyError(500, "Shopify didn’t create the customer segment.");
  return r.segmentCreate.segment.id;
}

type ExistingCode = {
  id: string;
  codeDiscount: {
    __typename: string;
    status?: string;
    context?: { __typename: string; segments?: { id: string }[] };
    customerGets?: { value?: { percentage?: number } };
  };
} | null;

async function ensureDiscount(shop: string, token: string, level: Level, segmentId: string) {
  const d = await graphql<{ codeDiscountNodeByCode: ExistingCode }>(
    shop,
    token,
    `query($code: String!) {
      codeDiscountNodeByCode(code: $code) {
        id
        codeDiscount {
          __typename
          ... on DiscountCodeBasic {
            status
            context { __typename ... on DiscountCustomerSegments { segments { id } } }
            customerGets { value { ... on DiscountPercentage { percentage } } }
          }
        }
      }
    }`,
    { code: level.code },
  );
  const node = d.codeDiscountNodeByCode;
  if (node) {
    // A code of that name made by hand must not be open to everyone: it would
    // give the discount to people who aren't members. Check, never edit.
    const c = node.codeDiscount;
    const limited = c.context?.__typename === "DiscountCustomerSegments" && c.context.segments?.some((s) => s.id === segmentId);
    if (c.__typename !== "DiscountCodeBasic" || !limited) {
      throw new ShopifyError(
        409,
        `A ${level.code} code already exists in Shopify and isn’t limited to the “${level.segment}” customer segment, so anyone could use it. Delete it in Shopify (Discounts) or limit it to that segment, then set up again.`,
      );
    }
    const pct = c.customerGets?.value?.percentage;
    if (typeof pct === "number" && Math.abs(pct - level.percent / 100) > 0.0001) {
      throw new ShopifyError(409, `The ${level.code} code in Shopify gives ${Math.round(pct * 100)}%, not ${level.percent}%. Fix it in Shopify (Discounts) or delete it and set up again.`);
    }
    return node.id;
  }
  const r = await graphql<{ discountCodeBasicCreate: { codeDiscountNode: { id: string } | null; userErrors: UserErrors } }>(
    shop,
    token,
    `mutation($d: DiscountCodeBasicInput!) {
      discountCodeBasicCreate(basicCodeDiscount: $d) { codeDiscountNode { id } userErrors { field message } }
    }`,
    {
      d: {
        title: level.title,
        code: level.code,
        startsAt: new Date().toISOString(),
        appliesOncePerCustomer: false,
        context: { customerSegments: { add: [segmentId] } },
        customerGets: { value: { percentage: level.percent / 100 }, items: { all: true } },
        combinesWith: { productDiscounts: false, orderDiscounts: false, shippingDiscounts: true },
      },
    },
  );
  userErrors(r.discountCodeBasicCreate.userErrors);
  if (!r.discountCodeBasicCreate.codeDiscountNode) throw new ShopifyError(500, "Shopify didn’t create the discount code.");
  return r.discountCodeBasicCreate.codeDiscountNode.id;
}

/** Make the two customer segments and the two codes, or find them if they're there. Safe to repeat. */
export async function setupDiscounts(sb: Sb, i: Integration & { shop_domain: string; secret: string }) {
  const token = await tokenFor(sb, i);
  const settings: Settings = { segments: {}, discounts: {} };
  const made: string[] = [];
  for (const level of LEVELS) {
    const had = settingsOf(i).discounts?.[level.code];
    const segmentId = await ensureSegment(i.shop_domain, token, level);
    const discountId = await ensureDiscount(i.shop_domain, token, level, segmentId);
    settings.segments![level.code] = segmentId;
    settings.discounts![level.code] = discountId;
    if (!had) made.push(level.code);
  }
  await saveSettings(sb, settings);
  await logEvent(sb, {
    direction: "out",
    kind: "sync",
    ok: true,
    detail: made.length ? `Set up ${made.join(" and ")} in Shopify (a customer segment and a code each).` : "Checked the member10 and member20 codes in Shopify: all in place.",
  });
  return { made };
}

/** Merge into the saved settings, so the discount ids and the orders cursor never overwrite each other. */
async function saveSettings(sb: Sb, patch: Settings) {
  const fresh = await getIntegration(sb);
  await sb
    .from("integrations")
    .update({ settings: { ...(fresh ? settingsOf(fresh) : {}), ...patch } as unknown as Json })
    .eq("key", "shopify");
}

// Customers ---------------------------------------------------------------------------

type ShopCustomer = { id: string; email: string | null; tags: string[] };

/** Every Shopify customer carrying an ARK tag. */
async function taggedCustomers(shop: string, token: string): Promise<ShopCustomer[]> {
  const out = new Map<string, ShopCustomer>();
  for (const tag of ARK_TAGS) {
    let after: string | null = null;
    for (let page = 0; page < 40; page++) {
      const d: { customers: { nodes: ShopCustomer[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } } = await graphql(
        shop,
        token,
        `query($q: String!, $after: String) {
          customers(first: 250, query: $q, after: $after) { nodes { id email tags } pageInfo { hasNextPage endCursor } }
        }`,
        { q: `tag:${tag}`, after },
      );
      for (const c of d.customers.nodes) out.set(c.id, c);
      if (!d.customers.pageInfo.hasNextPage) break;
      after = d.customers.pageInfo.endCursor;
    }
  }
  return [...out.values()];
}

async function customerByEmail(shop: string, token: string, email: string): Promise<ShopCustomer | null> {
  const d = await graphql<{ customerByIdentifier: ShopCustomer | null }>(
    shop,
    token,
    `query($email: String!) { customerByIdentifier(identifier: { emailAddress: $email }) { id email tags } }`,
    { email },
  );
  return d.customerByIdentifier;
}

async function createCustomer(shop: string, token: string, email: string, name: string | null, tags: string[]) {
  const [first, ...rest] = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const r = await graphql<{ customerCreate: { customer: { id: string } | null; userErrors: UserErrors } }>(
    shop,
    token,
    `mutation($input: CustomerInput!) { customerCreate(input: $input) { customer { id } userErrors { field message } } }`,
    { input: { email, firstName: first || undefined, lastName: rest.join(" ") || undefined, tags } },
  );
  userErrors(r.customerCreate.userErrors);
  if (!r.customerCreate.customer) throw new ShopifyError(500, "Shopify didn’t create the customer.");
  return r.customerCreate.customer.id;
}

async function setTags(shop: string, token: string, id: string, add: string[], remove: string[]) {
  // Remove first, so a customer is never briefly in both segments.
  if (remove.length) {
    const r = await graphql<{ tagsRemove: { userErrors: UserErrors } }>(
      shop,
      token,
      `mutation($id: ID!, $tags: [String!]!) { tagsRemove(id: $id, tags: $tags) { userErrors { message } } }`,
      { id, tags: remove },
    );
    userErrors(r.tagsRemove.userErrors);
  }
  if (add.length) {
    const r = await graphql<{ tagsAdd: { userErrors: UserErrors } }>(
      shop,
      token,
      `mutation($id: ID!, $tags: [String!]!) { tagsAdd(id: $id, tags: $tags) { userErrors { message } } }`,
      { id, tags: add },
    );
    userErrors(r.tagsAdd.userErrors);
  }
}

// What ARK OS says ---------------------------------------------------------------------

type Member = { contact_id: string; email: string; name: string; level: Level };

/** Memberships that cover today, for people with an email, as the best level each. */
async function currentMembers(sb: Sb, today: string) {
  const byEmail = new Map<string, Member>();
  let noEmail = 0;
  const seenNoEmail = new Set<string>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from("memberships")
      .select(
        "contact_id, status, starts_on, ends_on, tier, contacts!memberships_contact_id_fkey(id, name, email)",
      )
      .in("status", ["active", "cancelled"])
      .lte("starts_on", today)
      .or(`ends_on.is.null,ends_on.gte.${today}`)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const grouped = new Map<string, { name: string; email: string | null; rows: MembershipRow[] }>();
    for (const r of rows) {
      const c = Array.isArray(r.contacts) ? r.contacts[0] : r.contacts;
      if (!c) continue;
      const g = grouped.get(c.id) ?? { name: c.name, email: c.email, rows: [] as MembershipRow[] };
      g.rows.push({ status: r.status, starts_on: r.starts_on, ends_on: r.ends_on, tier: r.tier });
      grouped.set(c.id, g);
    }
    for (const [contact_id, g] of grouped) {
      const level = levelOn(g.rows, today);
      if (!level) continue;
      const email = normEmail(g.email);
      if (!email || !email.includes("@")) {
        if (!seenNoEmail.has(contact_id)) {
          seenNoEmail.add(contact_id);
          noEmail++;
        }
        continue;
      }
      const have = byEmail.get(email);
      if (!have || level.percent > have.level.percent) byEmail.set(email, { contact_id, email, name: g.name, level });
    }
    if (rows.length < PAGE) break;
  }
  return { byEmail, noEmail };
}

async function link(sb: Sb, contactId: string, customerId: string) {
  await sb
    .from("integration_links")
    .upsert({ provider: "shopify", contact_id: contactId, external_id: customerId, synced_at: new Date().toISOString() }, { onConflict: "provider,contact_id" });
}

// Orders from Shopify ---------------------------------------------------------------

export type OrdersResult = {
  /** First run: the clock is set, nothing is imported from before it. */
  started: boolean;
  imported: number;
  reversed: number;
  portal: number;
  newContacts: number;
  /** Lines in imported orders that match no product in the catalog. */
  unmatched: number;
  /** Orders still waiting for the next run (out of time or more pages). */
  more: boolean;
  errors: string[];
};

export const ordersLine = (o: OrdersResult) =>
  o.started
    ? "Online orders: counting from now."
    : `Online orders: ${o.imported} counted, ${o.reversed} taken back out` +
      `${o.portal ? `, ${o.portal} portal orders already in` : ""}${o.newContacts ? `, ${o.newContacts} new contacts` : ""}` +
      `${o.unmatched ? `, ${plural(o.unmatched, "line")} matched no product` : ""}${o.more ? ", more waiting for the next run" : ""}`;

const ORDER_FIELDS = `
  id name email createdAt updatedAt cancelledAt displayFinancialStatus tags currencyCode paymentGatewayNames
  totalPriceSet { shopMoney { amount } }
  customer { id firstName lastName email emailMarketingConsent { marketingState } }
  lineItems(first: 100) { nodes { quantity title variant { id } discountedTotalSet { shopMoney { amount } } } }`;

const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** The contact for an order's email, made if there isn't one (only people who ordered). */
async function contactForOrder(sb: Sb, o: OrderNode, email: string): Promise<{ id: string; created: boolean }> {
  const find = async () => (await sb.from("contacts").select("id").ilike("email", likeEscape(email)).limit(1).maybeSingle()).data?.id ?? null;
  const have = await find();
  if (have) return { id: have, created: false };
  // Not mailed until they've said so in Shopify.
  const { data, error } = await sb
    .from("contacts")
    .insert({ name: contactName(o), email, type: "contact", source: "shopify", email_opt_out: optedOutOfMarketing(o) })
    .select("id")
    .single();
  if (error) {
    const raced = await find();
    if (raced) return { id: raced, created: false };
    throw new Error(error.message);
  }
  return { id: data.id, created: true };
}

/**
 * Bring online orders into ARK OS, oldest change first. A run picks up where
 * the last stopped (orders changed since), so a payment, a cancellation or a
 * refund after the order was first seen updates it. The very first run only
 * sets the starting point: history isn't pulled in, so sales already counted
 * by hand aren't counted twice.
 */
export async function pullOrders(sb: Sb, i: Integration & { shop_domain: string; secret: string }, token: string, started = Date.now()): Promise<OrdersResult> {
  const r: OrdersResult = { started: false, imported: 0, reversed: 0, portal: 0, newContacts: 0, unmatched: 0, more: false, errors: [] };
  const since = settingsOf(i).ordersSince;
  if (!since) {
    await saveSettings(sb, { ordersSince: new Date(started).toISOString() });
    r.started = true;
    return r;
  }

  let after: string | null = null;
  let cursor = since;
  outer: for (let page = 0; page < 20; page++) {
    const d: { orders: { nodes: OrderNode[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } } = await graphql(
      i.shop_domain,
      token,
      `query($q: String!, $after: String) {
        orders(first: 50, query: $q, after: $after, sortKey: UPDATED_AT) { nodes {${ORDER_FIELDS}} pageInfo { hasNextPage endCursor } }
      }`,
      { q: `updated_at:>='${since}'`, after },
    );
    for (const node of d.orders.nodes) {
      if (Date.now() - started > BUDGET_MS) {
        r.more = true;
        break outer;
      }
      try {
        const rec = toRecord(node);
        let contactId: string | null = null;
        if (rec.email && !rec.portal) {
          const c = await contactForOrder(sb, node, rec.email);
          contactId = c.id;
          if (c.created) r.newContacts++;
          if (node.customer) await link(sb, c.id, node.customer.id);
        }
        const { data, error } = await sb.rpc("record_shopify_order", { p: { ...rec, contact_id: contactId } as unknown as Json }).single();
        if (error || !data) throw new Error(error?.message ?? "no result");
        if (data.action === "imported") {
          r.imported++;
          r.unmatched += data.unmatched;
        } else if (data.action === "reversed") r.reversed++;
        else if (data.action === "portal") r.portal++;
        cursor = node.updatedAt;
      } catch (e) {
        // Stop here so the next run starts at this order again, in order.
        r.errors.push(`Order ${node.name}: ${errorText(e)}`);
        break outer;
      }
    }
    if (!d.orders.pageInfo.hasNextPage) break;
    after = d.orders.pageInfo.endCursor;
    if (page === 19) r.more = true;
  }
  if (cursor !== since) await saveSettings(sb, { ordersSince: cursor });
  return r;
}

// The sync ----------------------------------------------------------------------------

export type SyncResult = {
  orders: OrdersResult | null;
  members: number;
  tagged: number;
  untagged: number;
  created: number;
  noEmail: number;
  left: number;
  errors: string[];
};

/**
 * Bring Shopify's tags in line with who is a member today. Adds the tag for
 * members, takes it off anyone whose membership has ended, paused or never
 * started, and makes customers for members who have none yet.
 */
export async function runSync(sb: Sb): Promise<SyncResult | { error: string }> {
  const i = await getIntegration(sb);
  if (!ready(i)) return { error: "Shopify isn’t connected." };
  const started = Date.now();
  const startedAt = new Date().toISOString();
  const r: SyncResult = { orders: null, members: 0, tagged: 0, untagged: 0, created: 0, noEmail: 0, left: 0, errors: [] };

  let token: string;
  try {
    token = await tokenFor(sb, i);
  } catch (e) {
    await logEvent(sb, { direction: "out", kind: "test", ok: false, detail: errorText(e) });
    await sb.from("integrations").update({ last_error: errorText(e) }).eq("key", "shopify");
    return { error: errorText(e) };
  }

  // Paid portal orders that never reached Shopify (it was paused, or down) go first.
  try {
    const sent = await retryUnsentOrders();
    if (sent.failed) r.errors.push(`${plural(sent.failed, "portal order")} still not in Shopify`);
  } catch (e) {
    r.errors.push(`Portal orders: ${errorText(e)}`);
  }

  try {
    // The codes are set up once; a run never leaves the tags without them.
    if (!settingsOf(i).discounts?.member10 || !settingsOf(i).discounts?.member20) await setupDiscounts(sb, i);

    const [{ byEmail, noEmail }, have] = await Promise.all([currentMembers(sb, todayIn()), taggedCustomers(i.shop_domain, token)]);
    r.members = byEmail.size;
    r.noEmail = noEmail;
    const changes = diffTags({ want: new Map([...byEmail].map(([e, m]) => [e, m.level])), have });
    // Removals first: ending a discount matters more than giving a new one.
    changes.sort((a, b) => Number(b.remove.length > 0) - Number(a.remove.length > 0));

    for (const [n, c] of changes.entries()) {
      if (Date.now() - started > BUDGET_MS) {
        r.left = changes.length - n;
        break;
      }
      const member = byEmail.get(c.email);
      try {
        let id = c.id;
        if (!id) {
          // A member with no tagged customer: they may exist in Shopify untagged, or not at all.
          const found = await customerByEmail(i.shop_domain, token, c.email);
          if (found) id = found.id;
          else {
            id = await createCustomer(i.shop_domain, token, c.email, member?.name ?? null, c.add);
            r.created++;
            r.tagged++;
            if (member) await link(sb, member.contact_id, id);
            continue;
          }
        }
        await setTags(i.shop_domain, token, id, c.add, c.remove);
        if (c.add.length) r.tagged++;
        else r.untagged++;
        if (member) await link(sb, member.contact_id, id);
      } catch (e) {
        r.errors.push(`${c.email}: ${errorText(e)}`);
        // The token or the app's permissions are wrong: every other call will fail the same way.
        if (e instanceof ShopifyError && (e.status === 401 || e.status === 403)) break;
      }
    }
  } catch (e) {
    r.errors.push(errorText(e));
  }

  // Online orders come in whether or not the tags could be set (a missing
  // discount code, say, has nothing to do with them).
  try {
    r.orders = await pullOrders(sb, i, token, started);
    r.errors.push(...r.orders.errors);
  } catch (e) {
    r.errors.push(`Orders: ${errorText(e)}`);
  }

  await logEvent(sb, {
    direction: "out",
    kind: "sync",
    ok: r.errors.length === 0,
    detail:
      `${plural(r.members, "member")} entitled today. Tagged ${r.tagged} (${r.created} new in Shopify), took the tag off ${r.untagged}` +
      `${r.noEmail ? `, ${r.noEmail} without an email skipped` : ""}${r.left ? `, ${r.left} left for the next run` : ""}` +
      `${r.orders ? ` ${ordersLine(r.orders)}` : ""}` +
      `${r.errors.length ? `, ${plural(r.errors.length, "failure")}: ${r.errors.slice(0, 4).join(" | ")}` : "."}`,
  });
  await sb
    .from("integrations")
    .update({ last_sync_at: startedAt, last_error: r.errors.length ? r.errors.slice(0, 4).join(" | ") : null })
    .eq("key", "shopify");
  return r;
}

/**
 * One person, right after their membership changes (paid, edited, ended by
 * hand). Quiet on purpose; the nightly run catches anything this misses.
 */
export async function pushContact(sb: Sb, contactId: string) {
  const i = await getIntegration(sb);
  if (!ready(i)) return;
  const { data: c } = await sb.from("contacts").select("id, name, email").eq("id", contactId).maybeSingle();
  const email = normEmail(c?.email);
  if (!c || !email.includes("@")) return;
  try {
    const token = await tokenFor(sb, i);
    const { data } = await sb
      .from("memberships")
      .select("status, starts_on, ends_on, tier")
      .eq("contact_id", contactId);
    const rows = (data ?? []).map<MembershipRow>((m) => ({ status: m.status, starts_on: m.starts_on, ends_on: m.ends_on, tier: m.tier }));
    const level = levelOn(rows, todayIn());
    const found = await customerByEmail(i.shop_domain, token, email);
    const [change] = diffTags({
      want: new Map(level ? [[email, level]] : []),
      have: found ? [found] : [],
    });
    if (!change) return;
    if (!found) {
      const id = await createCustomer(i.shop_domain, token, email, c.name, change.add);
      await link(sb, c.id, id);
    } else {
      await setTags(i.shop_domain, token, found.id, change.add, change.remove);
      await link(sb, c.id, found.id);
    }
    await logEvent(sb, {
      direction: "out",
      kind: "push",
      ok: true,
      detail: level ? `Tagged ${email} ${level.tag} in Shopify.` : `Took the member tag off ${email} in Shopify.`,
      contact_id: contactId,
    });
  } catch (e) {
    await logEvent(sb, { direction: "out", kind: "push", ok: false, detail: `${email}: ${errorText(e)}`, contact_id: contactId });
  }
}

// Orders from the member portal ------------------------------------------------------

type PortalOrder = Tables<"portal_shop_orders">;
type PortalLine = { id: string; name: string; label: string | null; qty: number; list: number; unit: number };

/**
 * Put a paid portal order into Shopify as an already-paid order, so stock and
 * picking stay there. Each line carries the member price the member paid
 * (rather than asking Shopify to work the discount out again), the order is
 * tagged for pickup, and Shopify's own receipt email is off (Stripe sent one).
 * Never throws: a failure is kept on the order for the team to see.
 */
export async function pushOrder(sb: Sb, orderId: string) {
  const fail = async (message: string) => {
    await sb.from("portal_shop_orders").update({ shopify_error: message }).eq("id", orderId);
    await logEvent(sb, { direction: "out", kind: "push", ok: false, detail: `Order ${orderId.slice(0, 8)}: ${message}` });
  };
  try {
    const { data: o } = await sb.from("portal_shop_orders").select("*").eq("id", orderId).maybeSingle();
    if (!o || o.status !== "paid") return;
    if (o.shopify_order_id) return;
    const i = await getIntegration(sb);
    if (!ready(i)) return fail("Shopify isn’t connected, so this order was not sent. Pick it from the ledger or send it by hand.");
    const { data: c } = await sb.from("contacts").select("name, email").eq("id", o.contact_id).maybeSingle();
    const token = await tokenFor(sb, i);
    const [first, ...rest] = (c?.name ?? "").trim().split(/\s+/).filter(Boolean);
    const money = (n: number) => ({ shopMoney: { amount: n.toFixed(2), currencyCode: o.currency } });
    const lines = o.lines as unknown as PortalLine[];
    const total = lines.reduce((n, l) => n + l.unit * l.qty, 0);
    const d = await graphql<{ orderCreate: { order: { id: string; name: string } | null; userErrors: UserErrors } }>(
      i.shop_domain,
      token,
      `mutation($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) {
        orderCreate(order: $order, options: $options) { order { id name } userErrors { field message } }
      }`,
      {
        order: {
          email: c?.email || undefined,
          customer: c?.email ? { toUpsert: { email: c.email, firstName: first || undefined, lastName: rest.join(" ") || undefined } } : undefined,
          currency: o.currency,
          financialStatus: "PAID",
          lineItems: lines.map((l) => ({ variantId: `gid://shopify/ProductVariant/${l.id}`, quantity: l.qty, priceSet: money(l.unit) })),
          transactions: [{ kind: "SALE", status: "SUCCESS", gateway: "Stripe (ARK OS)", amountSet: money(total) }],
          tags: ["ark-portal", "pickup", ...(o.discount_percent > 0 ? [`member${o.discount_percent}`] : [])],
          note: `Paid in the ARK member portal. Pick up at The ARK.${o.discount_percent > 0 ? ` Member discount ${o.discount_percent}% already taken off each price.` : ""} ARK OS order ${o.id}.`,
          sourceName: "ark-portal",
        },
        options: { inventoryBehaviour: "DECREMENT_IGNORING_POLICY", sendReceipt: false, sendFulfillmentReceipt: false },
      },
    );
    userErrors(d.orderCreate.userErrors);
    if (!d.orderCreate.order) throw new ShopifyError(500, "Shopify didn’t create the order.");
    const { error: saveError } = await sb
      .from("portal_shop_orders")
      .update({ shopify_order_id: d.orderCreate.order.id, shopify_order_name: d.orderCreate.order.name, shopify_error: null })
      .eq("id", orderId);
    if (saveError) {
      await logEvent(sb, { direction: "out", kind: "push", ok: false, detail: `Order ${d.orderCreate.order.name} was created in Shopify but not saved here (${saveError.message}). Do not send it again.` });
      return;
    }
    await logEvent(sb, { direction: "out", kind: "push", ok: true, detail: `Order ${d.orderCreate.order.name} created in Shopify (${plural(lines.length, "line")}, paid).`, contact_id: o.contact_id });
  } catch (e) {
    await fail(errorText(e));
  }
}

/** Send every paid portal order that has no Shopify order yet. Oldest first. */
export async function retryUnsentOrders() {
  // Portal orders can only be written with the service role (RLS), and a push that
  // can't record its Shopify order id would be sent again next time.
  const sb = createAdminClient();
  if (!sb) return { tried: 0, failed: 0 };
  const { data } = await sb
    .from("portal_shop_orders")
    .select("id")
    .eq("status", "paid")
    .is("shopify_order_id", null)
    .order("paid_at", { ascending: true })
    .limit(25);
  let failed = 0;
  for (const o of data ?? []) {
    await pushOrder(sb, o.id);
    const { data: after } = await sb.from("portal_shop_orders").select("shopify_order_id").eq("id", o.id).maybeSingle();
    if (!after?.shopify_order_id) failed++;
  }
  return { tried: data?.length ?? 0, failed };
}

export type { PortalOrder };
