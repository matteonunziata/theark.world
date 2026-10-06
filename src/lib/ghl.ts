import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/database.types";
import {
  arkTags,
  canPush,
  type ContactIn,
  type ContactOut,
  parseGhlContact,
  tagChanges,
  toGhlContact,
} from "@/lib/ghl-map";

// GoHighLevel (GHL) contact sync. Contacts go out with upsert (matched by
// email or phone, so nothing is doubled) and get ark: tags for membership
// and pipeline stage. Contacts come in from a search on what changed since
// the last sync, and from the webhook at /api/webhooks/ghl. Coming in, we
// only create people we don't have and fill empty fields; ARK OS is the
// source of truth for members.

type Sb = SupabaseClient<Database>;
export type Integration = Tables<"integrations">;

const BASE = "https://services.leadconnectorhq.com";
const VERSION = "2021-07-28";
const PAGE = 100;
const MAX_PULL = 2000;

export class GhlError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function describe(status: number, json: unknown) {
  let msg = "";
  if (json && typeof json === "object" && "message" in json) {
    const m = (json as { message: unknown }).message;
    msg = Array.isArray(m) ? m.join(", ") : typeof m === "string" ? m : "";
  }
  if (status === 401) return "GHL didn’t accept the token. Check it, or make a new one.";
  if (status === 403) return `The token is missing a permission${msg ? ` (${msg})` : ""}. Give it the contacts scopes.`;
  if (status === 429) return "GHL is limiting requests. Try again in a minute.";
  return msg ? `GHL said: ${msg}` : `GHL returned ${status}.`;
}

async function api<T>(
  token: string,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(BASE + path, {
    method: init.method ?? (init.body ? "POST" : "GET"),
    headers: {
      Authorization: `Bearer ${token}`,
      Version: VERSION,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) throw new GhlError(res.status, describe(res.status, json));
  return json as T;
}

const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong talking to GHL.";

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Can we reach the sub-account with this token? Returns its name when the token may read locations. */
export async function testConnection(token: string, locationId: string) {
  await api(token, `/contacts/?locationId=${encodeURIComponent(locationId)}&limit=1`);
  try {
    const r = await api<{ location?: { name?: string } }>(token, `/locations/${encodeURIComponent(locationId)}`);
    return r.location?.name ?? null;
  } catch {
    return null;
  }
}

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
  await sb.from("integration_events").insert({ provider: "ghl", ...e });
}

export async function getIntegration(sb: Sb) {
  const { data } = await sb.from("integrations").select("*").eq("key", "ghl").maybeSingle();
  return data;
}

const ready = (i: Integration | null): i is Integration & { secret: string; location_id: string } =>
  !!i && i.enabled && !!i.secret && !!i.location_id;

// Out: ARK OS → GHL ---------------------------------------------------------

type PushResult = { pushed: number; skipped: number; errors: string[] };

async function push(sb: Sb, i: Integration & { secret: string; location_id: string }, only?: string): Promise<PushResult> {
  const r: PushResult = { pushed: 0, skipped: 0, errors: [] };
  let q = sb
    .from("contacts")
    .select("id, name, email, phone, source, tier, membership_status, updated_at")
    .order("updated_at");
  if (only) q = q.eq("id", only);
  const [{ data: contacts, error }, { data: samples }, { data: links }, { data: stages }] = await Promise.all([
    q,
    sb.from("sample_records").select("record_id").eq("table_name", "contacts"),
    sb.from("integration_links").select("contact_id, external_id, synced_at").eq("provider", "ghl"),
    sb.from("contact_stages").select("contact_id, pipeline, stage"),
  ]);
  if (error) {
    r.errors.push("Couldn’t read contacts.");
    return r;
  }
  const sample = new Set((samples ?? []).map((s) => s.record_id));
  const linked = new Map((links ?? []).map((l) => [l.contact_id, l]));
  const stageOf = new Map<string, { pipeline: string; stage: string }[]>();
  for (const s of stages ?? []) {
    stageOf.set(s.contact_id, [...(stageOf.get(s.contact_id) ?? []), s]);
  }

  for (const c of contacts ?? []) {
    // Sample people never leave ARK OS.
    if (sample.has(c.id) || !canPush(c)) {
      r.skipped++;
      continue;
    }
    const link = linked.get(c.id);
    if (!only && link && link.synced_at >= c.updated_at) continue;
    const out: ContactOut = { ...c, stages: stageOf.get(c.id) ?? [] };
    try {
      const up = await api<{ new?: boolean; contact: { id: string; tags?: string[] } }>(
        i.secret,
        "/contacts/upsert",
        { body: toGhlContact(out, i.location_id) },
      );
      const id = up.contact.id;
      const ch = tagChanges(up.contact.tags ?? [], arkTags(out, i.tag));
      if (ch.add.length) await api(i.secret, `/contacts/${id}/tags`, { body: { tags: ch.add } });
      if (ch.remove.length) {
        await api(i.secret, `/contacts/${id}/tags`, { method: "DELETE", body: { tags: ch.remove } });
      }
      const { error: le } = await sb
        .from("integration_links")
        .upsert(
          { provider: "ghl", contact_id: c.id, external_id: id, synced_at: new Date().toISOString() },
          { onConflict: "provider,contact_id" },
        );
      if (le) {
        // Two ARK OS people matched one GHL contact (same phone, say).
        r.errors.push(`${c.name} matches a GHL contact that’s already linked to someone else.`);
        r.skipped++;
      } else {
        r.pushed++;
      }
    } catch (e) {
      r.errors.push(`${c.name}: ${errorText(e)}`);
      if (e instanceof GhlError && e.status === 429) break;
    }
    await pause(120);
  }
  return r;
}

// In: GHL → ARK OS ----------------------------------------------------------

type SearchHit = Record<string, unknown> & { searchAfter?: unknown[] };

/** Contacts changed in GHL since a time, through the search API. */
async function searchChanged(token: string, locationId: string, since: string | null) {
  const out: ContactIn[] = [];
  let searchAfter: unknown[] | undefined;
  for (let page = 0; page * PAGE < MAX_PULL; page++) {
    const r = await api<{ contacts?: SearchHit[] }>(token, "/contacts/search", {
      body: {
        locationId,
        pageLimit: PAGE,
        sort: [{ field: "dateUpdated", direction: "asc" }],
        filters: since ? [{ field: "dateUpdated", operator: "range", value: { gte: since } }] : [],
        ...(searchAfter ? { searchAfter } : {}),
      },
    });
    const hits = r.contacts ?? [];
    for (const h of hits) {
      const c = parseGhlContact(h);
      if (c) out.push(c);
    }
    if (hits.length < PAGE) break;
    searchAfter = hits[hits.length - 1].searchAfter;
    if (!searchAfter) break;
    await pause(120);
  }
  return out;
}

/** The plain list, for tokens or accounts where search isn't available. */
async function listChanged(token: string, locationId: string, since: string | null) {
  const out: ContactIn[] = [];
  let after = "";
  for (let page = 0; page * PAGE < MAX_PULL; page++) {
    const r = await api<{
      contacts?: Record<string, unknown>[];
      meta?: { startAfterId?: string; startAfter?: number };
    }>(token, `/contacts/?locationId=${encodeURIComponent(locationId)}&limit=${PAGE}${after}`);
    const hits = r.contacts ?? [];
    for (const h of hits) {
      const c = parseGhlContact(h);
      if (c && (!since || !c.updatedAt || c.updatedAt >= since)) out.push(c);
    }
    if (hits.length < PAGE || !r.meta?.startAfterId) break;
    after = `&startAfterId=${encodeURIComponent(r.meta.startAfterId)}&startAfter=${r.meta.startAfter ?? ""}`;
    await pause(120);
  }
  return out;
}

async function changedInGhl(token: string, locationId: string, since: string | null) {
  try {
    return await searchChanged(token, locationId, since);
  } catch (e) {
    if (e instanceof GhlError && (e.status === 400 || e.status === 404 || e.status === 422)) {
      return listChanged(token, locationId, since);
    }
    throw e;
  }
}

type AbsorbResult = { created: number; updated: number; skipped: number; errors: string[] };

/** Bring GHL contacts into the CRM: new people are added, known people get empty fields filled. */
export async function absorb(sb: Sb, incoming: ContactIn[]): Promise<AbsorbResult> {
  const r: AbsorbResult = { created: 0, updated: 0, skipped: 0, errors: [] };
  if (incoming.length === 0) return r;
  const ids = incoming.map((c) => c.id);
  const emails = incoming.map((c) => c.email).filter((e): e is string => !!e);
  const [{ data: links }, { data: known }] = await Promise.all([
    sb.from("integration_links").select("contact_id, external_id, synced_at").eq("provider", "ghl").in("external_id", ids),
    emails.length
      ? sb.from("contacts").select("id, email, phone, location").in("email", emails)
      : Promise.resolve({ data: [] as { id: string; email: string | null; phone: string | null; location: string | null }[] }),
  ]);
  const byExternal = new Map((links ?? []).map((l) => [l.external_id, l]));
  const byEmail = new Map((known ?? []).map((c) => [c.email?.toLowerCase() ?? "", c]));
  const now = new Date().toISOString();

  for (const g of incoming) {
    const link = byExternal.get(g.id);
    if (link && g.updatedAt && link.synced_at >= g.updatedAt) continue; // our own push coming back
    let contactId = link?.contact_id ?? null;
    if (!contactId && g.email) contactId = byEmail.get(g.email)?.id ?? null;

    if (contactId) {
      // Fill what's empty; never overwrite what staff typed.
      const { data: c } = await sb.from("contacts").select("phone").eq("id", contactId).maybeSingle();
      if (c && !c.phone && g.phone) {
        const { error } = await sb.from("contacts").update({ phone: g.phone }).eq("id", contactId);
        if (!error) r.updated++;
      }
    } else if (g.email) {
      const { data: created, error } = await sb
        .from("contacts")
        .insert({ name: g.name ?? g.email, email: g.email, phone: g.phone, source: g.source ?? "GoHighLevel" })
        .select("id")
        .single();
      if (error || !created) {
        r.errors.push(`${g.name ?? g.email}: couldn’t add to the CRM.`);
        continue;
      }
      contactId = created.id;
      r.created++;
    } else {
      r.skipped++; // no email to match on
      continue;
    }
    await sb
      .from("integration_links")
      .upsert({ provider: "ghl", contact_id: contactId, external_id: g.id, synced_at: now }, { onConflict: "provider,contact_id" });
  }
  return r;
}

// Runs ----------------------------------------------------------------------

export type SyncResult = {
  pushed: number;
  pulled: number;
  created: number;
  skipped: number;
  errors: string[];
};

/** A full sync both ways (as configured). Used by "Sync now" and the daily cron. */
export async function runSync(sb: Sb): Promise<SyncResult | { error: string }> {
  const i = await getIntegration(sb);
  if (!ready(i)) return { error: "GHL isn’t connected." };
  const startedAt = new Date().toISOString();
  const r: SyncResult = { pushed: 0, pulled: 0, created: 0, skipped: 0, errors: [] };

  if (i.direction !== "pull") {
    const p = await push(sb, i);
    r.pushed = p.pushed;
    r.skipped += p.skipped;
    r.errors.push(...p.errors);
    await logEvent(sb, {
      direction: "out",
      kind: "sync",
      ok: p.errors.length === 0,
      detail: `Sent ${p.pushed} contact${p.pushed === 1 ? "" : "s"} to GHL${p.errors.length ? `, ${p.errors.length} failed` : ""}.`,
    });
  }
  if (i.direction !== "push") {
    try {
      const changed = await changedInGhl(i.secret, i.location_id, i.last_sync_at);
      const a = await absorb(sb, changed);
      r.pulled = changed.length;
      r.created = a.created;
      r.skipped += a.skipped;
      r.errors.push(...a.errors);
      await logEvent(sb, {
        direction: "in",
        kind: "sync",
        ok: a.errors.length === 0,
        detail: `Checked ${changed.length} changed in GHL: ${a.created} new, ${a.updated} filled in, ${a.skipped} without email.`,
      });
    } catch (e) {
      r.errors.push(errorText(e));
      await logEvent(sb, { direction: "in", kind: "sync", ok: false, detail: errorText(e) });
    }
  }
  await sb
    .from("integrations")
    .update({ last_sync_at: startedAt, last_error: r.errors[0] ?? null })
    .eq("key", "ghl");
  return r;
}

/** Send one contact right after it's saved in the CRM. Quiet on purpose. */
export async function pushContact(sb: Sb, contactId: string) {
  const i = await getIntegration(sb);
  if (!ready(i) || i.direction === "pull") return;
  const p = await push(sb, i, contactId);
  if (p.pushed === 0 && p.errors.length === 0) return;
  await logEvent(sb, {
    direction: "out",
    kind: "push",
    ok: p.errors.length === 0,
    detail: p.errors[0] ?? "Sent to GHL after a save in the CRM.",
    contact_id: contactId,
  });
}

/** A contact posted by a GHL workflow webhook. */
export async function receiveWebhook(sb: Sb, body: unknown) {
  const c = parseGhlContact(body);
  if (!c) {
    await logEvent(sb, { direction: "in", kind: "webhook", ok: false, detail: "A webhook arrived without a contact id." });
    return { ok: false as const, status: 400, message: "No contact id" };
  }
  const a = await absorb(sb, [c]);
  const what = a.created ? "added to the CRM" : a.updated ? "filled in" : a.skipped ? "skipped (no email)" : "already up to date";
  const { data: link } = await sb
    .from("integration_links")
    .select("contact_id")
    .eq("provider", "ghl")
    .eq("external_id", c.id)
    .maybeSingle();
  await logEvent(sb, {
    direction: "in",
    kind: "webhook",
    ok: a.errors.length === 0,
    detail: a.errors[0] ?? `${c.name ?? c.email ?? c.id}: ${what}.`,
    contact_id: link?.contact_id ?? null,
  });
  return { ok: true as const, status: 200, message: what };
}
