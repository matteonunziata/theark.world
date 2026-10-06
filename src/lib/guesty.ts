import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/database.types";
import { addDays, todayIn } from "@/lib/dates";
import { nights } from "@/lib/estate";
import {
  blockRange,
  LISTING_FIELDS,
  type ListingIn,
  parseListing,
  parseReservation,
  parseWebhook,
  RESERVATION_FIELDS,
  type ReservationIn,
  stayStatus,
  timeOfDay,
} from "@/lib/guesty-map";

// Guesty sync. Reservations come in as stays (matched on the Guesty
// reservation id, so a change in Guesty updates the same stay), guests are
// linked to CRM contacts by email, and listing details can be copied onto the
// linked homes. Going out, stays booked in ARK OS become blocked nights on the
// Guesty calendar. Guesty is the source of truth for anything booked there.

type Sb = SupabaseClient<Database>;
export type Integration = Tables<"integrations">;

const BASE = "https://open-api.guesty.com/v1";
const TOKEN_URL = "https://open-api.guesty.com/oauth2/token";
const PAGE = 100;
const MAX_PULL = 2000;
const WEBHOOK_EVENTS = ["reservation.created.v2", "reservation.updated.v2"];
/** How far back the first sync looks for stays. */
const FIRST_SYNC_DAYS = 31;

export class GuestyError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function describe(status: number, json: unknown) {
  let msg = "";
  if (json && typeof json === "object") {
    const j = json as Record<string, unknown>;
    const m = j.message ?? j.error ?? j.error_description;
    msg = Array.isArray(m) ? m.join(", ") : typeof m === "string" ? m : "";
  }
  if (status === 401 || status === 403) return "Guesty didn’t accept the token. Check the client id and secret.";
  if (status === 429) return "Guesty is limiting requests. Try again in a few minutes.";
  if (status === 404) return "Guesty couldn’t find that.";
  return msg ? `Guesty said: ${msg}` : `Guesty returned ${status}.`;
}

const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong talking to Guesty.";

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function parseBody(res: Response) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text || null;
  }
}

/** A fresh 24-hour token. Guesty allows five a day per client, so callers keep it. */
export async function fetchToken(clientId: string, secret: string) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "open-api",
      client_id: clientId,
      client_secret: secret,
    }),
    cache: "no-store",
  });
  const json = await parseBody(res);
  if (!res.ok) {
    if (res.status === 429) {
      throw new GuestyError(429, "Guesty allows five new tokens a day, and that’s used up. Try again tomorrow.");
    }
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      throw new GuestyError(res.status, "Guesty didn’t accept the client id and secret.");
    }
    throw new GuestyError(res.status, describe(res.status, json));
  }
  const token = json && typeof json === "object" ? (json as { access_token?: unknown }).access_token : null;
  const expiresIn = json && typeof json === "object" ? Number((json as { expires_in?: unknown }).expires_in) : NaN;
  if (typeof token !== "string" || !token) throw new GuestyError(500, "Guesty didn’t return a token.");
  const seconds = Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 86400;
  return { token, expiresAt: new Date(Date.now() + seconds * 1000).toISOString() };
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
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const json = await parseBody(res);
  if (!res.ok) throw new GuestyError(res.status, describe(res.status, json));
  return json as T;
}

const q = (params: Record<string, string | number | undefined>) =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");

/** Guesty wraps lists as { results } on most endpoints and returns a plain array on a few. */
const results = (r: unknown): unknown[] =>
  Array.isArray(r) ? r : r && typeof r === "object" && Array.isArray((r as { results?: unknown }).results) ? (r as { results: unknown[] }).results : [];

/** Can we reach the account? Returns how many listings it has. */
export async function testConnection(clientId: string, secret: string) {
  const t = await fetchToken(clientId, secret);
  const r = await api<{ count?: number; results?: unknown[] }>(t.token, `/listings?${q({ limit: 1, fields: "title" })}`);
  const count = typeof r?.count === "number" ? r.count : results(r).length;
  return { ...t, listings: count };
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
  await sb.from("integration_events").insert({ provider: "guesty", ...e });
}

export async function getIntegration(sb: Sb) {
  const { data } = await sb.from("integrations").select("*").eq("key", "guesty").maybeSingle();
  return data;
}

type Ready = Integration & { secret: string; client_id: string };
const ready = (i: Integration | null): i is Ready => !!i && i.enabled && !!i.secret && !!i.client_id;

/** The saved token while it has an hour left, or a new one (kept for next time). */
async function tokenFor(sb: Sb, i: Ready) {
  if (i.access_token && i.token_expires_at && new Date(i.token_expires_at).getTime() - Date.now() > 3600_000) {
    return i.access_token;
  }
  const t = await fetchToken(i.client_id, i.secret);
  await sb
    .from("integrations")
    .update({ access_token: t.token, token_expires_at: t.expiresAt })
    .eq("key", "guesty");
  return t.token;
}

// In: listings ---------------------------------------------------------------

async function pullListings(token: string) {
  const out: ListingIn[] = [];
  for (let skip = 0; skip < MAX_PULL; skip += PAGE) {
    const r = await api<unknown>(token, `/listings?${q({ limit: PAGE, skip, fields: LISTING_FIELDS, sort: "_id" })}`);
    const page = results(r);
    for (const raw of page) {
      const l = parseListing(raw);
      if (l) out.push(l);
    }
    if (page.length < PAGE) break;
    await pause(120);
  }
  return out;
}

async function cacheListings(sb: Sb, listings: ListingIn[]) {
  if (!listings.length) return;
  const now = new Date().toISOString();
  await sb.from("guesty_listings").upsert(
    listings.map((l) => ({ ...l, seen_at: now })),
    { onConflict: "id" },
  );
}

const money = (c: string | null) => (c === "USD" || c === "CRC" ? c : null);

/** Copy rate, sleeps, rooms, minimum nights and times onto the homes linked to these listings. */
async function applyDetails(sb: Sb, listings: ListingIn[]) {
  const { data: lots } = await sb.from("lots").select("id, guesty_listing_id").not("guesty_listing_id", "is", null);
  const byListing = new Map((lots ?? []).map((l) => [l.guesty_listing_id as string, l.id]));
  let n = 0;
  for (const l of listings) {
    const lotId = byListing.get(l.id);
    if (!lotId) continue;
    const patch: Database["public"]["Tables"]["lots"]["Update"] = {};
    if (l.base_price !== null && money(l.currency)) {
      patch.nightly_rate = l.base_price;
      patch.rate_currency = l.currency as string;
    }
    if (l.cleaning_fee !== null && money(l.currency)) patch.cleaning_fee = l.cleaning_fee;
    if (l.accommodates) patch.max_guests = l.accommodates;
    if (l.min_nights) patch.min_nights = l.min_nights;
    if (l.bedrooms !== null) patch.bedrooms = l.bedrooms;
    if (l.beds !== null) patch.beds = l.beds;
    if (l.bathrooms !== null) patch.bathrooms = l.bathrooms;
    const cin = timeOfDay(l.check_in_time);
    const cout = timeOfDay(l.check_out_time);
    if (cin) patch.check_in_time = cin;
    if (cout) patch.check_out_time = cout;
    if (!Object.keys(patch).length) continue;
    const { error } = await sb.from("lots").update(patch).eq("id", lotId);
    if (!error) n++;
  }
  return n;
}

// In: reservations -----------------------------------------------------------

async function changedReservations(token: string, since: string | null, today: string) {
  const filters = since
    ? [{ field: "lastUpdatedAt", operator: "$gt", value: since }]
    : [{ field: "checkOutDateLocalized", operator: "$gte", value: addDays(today, -FIRST_SYNC_DAYS) }];
  const out: ReservationIn[] = [];
  for (let skip = 0; skip < MAX_PULL; skip += PAGE) {
    const r = await api<unknown>(
      token,
      `/reservations?${q({ limit: PAGE, skip, fields: RESERVATION_FIELDS, sort: "_id", filters: JSON.stringify(filters) })}`,
    );
    const page = results(r);
    for (const raw of page) {
      const p = parseReservation(raw);
      if (p) out.push(p);
    }
    if (page.length < PAGE) break;
    await pause(120);
  }
  return out;
}

/** The CRM contact for a Guesty guest: linked already, matched by email, or added. */
async function linkGuest(sb: Sb, r: ReservationIn) {
  if (r.guestId) {
    const { data: link } = await sb
      .from("integration_links")
      .select("contact_id")
      .eq("provider", "guesty")
      .eq("external_id", r.guestId)
      .maybeSingle();
    if (link) return link.contact_id;
  }
  if (!r.email) return null;
  const { data: known } = await sb.from("contacts").select("id, phone").eq("email", r.email).limit(1).maybeSingle();
  let contactId = known?.id ?? null;
  if (known && !known.phone && r.phone) await sb.from("contacts").update({ phone: r.phone }).eq("id", known.id);
  if (!contactId) {
    const { data: created } = await sb
      .from("contacts")
      .insert({ name: r.guestName ?? r.email, email: r.email, phone: r.phone, source: "Guesty" })
      .select("id")
      .single();
    contactId = created?.id ?? null;
  }
  if (contactId && r.guestId) {
    await sb
      .from("integration_links")
      .upsert(
        { provider: "guesty", contact_id: contactId, external_id: r.guestId, synced_at: new Date().toISOString() },
        { onConflict: "provider,contact_id" },
      );
  }
  return contactId;
}

export type AbsorbResult = {
  created: number;
  updated: number;
  cancelled: number;
  unmapped: number;
  skipped: number;
  errors: string[];
};

/** Bring Guesty reservations in as stays. Guesty wins on dates, guest, status and money; notes stay ours. */
export async function absorbReservations(sb: Sb, incoming: ReservationIn[]): Promise<AbsorbResult> {
  const r: AbsorbResult = { created: 0, updated: 0, cancelled: 0, unmapped: 0, skipped: 0, errors: [] };
  if (!incoming.length) return r;
  const [{ data: lots }, { data: existing }] = await Promise.all([
    sb.from("lots").select("id, code, name, guesty_listing_id").not("guesty_listing_id", "is", null),
    sb
      .from("stays")
      .select("id, external_id")
      .eq("source", "guesty")
      .in(
        "external_id",
        incoming.map((x) => x.id),
      ),
  ]);
  const lotOf = new Map((lots ?? []).map((l) => [l.guesty_listing_id as string, l]));
  const stayOf = new Map((existing ?? []).map((s) => [s.external_id as string, s.id]));

  for (const g of incoming) {
    const status = stayStatus(g.status);
    if (!g.checkIn || !g.checkOut || g.checkOut <= g.checkIn || !status) {
      r.skipped++;
      continue;
    }
    const lot = g.listingId ? lotOf.get(g.listingId) : undefined;
    if (!lot) {
      r.unmapped++;
      continue;
    }
    const name = g.guestName ?? g.email ?? "Guesty guest";
    const contactId = await linkGuest(sb, g);
    const n = nights(g.checkIn, g.checkOut);
    const currency = money(g.currency);
    const total = currency && g.total !== null && g.total >= 0 ? g.total : null;
    const row: Database["public"]["Tables"]["stays"]["Insert"] = {
      lot_id: lot.id,
      kind: "guest",
      status,
      guest_name: name,
      email: g.email,
      phone: g.phone,
      guests: g.guests,
      check_in: g.checkIn,
      check_out: g.checkOut,
      currency: currency ?? "USD",
      total,
      nightly_rate: total !== null && n > 0 ? Math.round((total / n) * 100) / 100 : null,
      paid: g.paid ?? false,
      source: "guesty",
      channel: g.channel,
      external_id: g.id,
      external_ref: g.confirmationCode,
      contact_id: contactId,
    };
    const id = stayOf.get(g.id);
    const where = `${lot.name ?? `Lot ${lot.code}`}, ${g.checkIn} to ${g.checkOut}`;
    const save = async (status: "inquiry" | "confirmed" | "cancelled", note?: string) =>
      id
        ? sb.from("stays").update({ ...row, status }).eq("id", id)
        : sb.from("stays").insert({
            ...row,
            status,
            notes: [`Booked on ${g.channel ?? "Guesty"}${g.confirmationCode ? ` (${g.confirmationCode})` : ""}.`, note]
              .filter(Boolean)
              .join(" "),
          });
    let { error } = await save(status);
    if (error?.code === "23P01" && status === "confirmed") {
      // Those nights are already held by a stay booked here. Keep Guesty's
      // booking visible as an inquiry and say so.
      ({ error } = await save("inquiry", "Overlaps a confirmed stay in ARK OS; sort out which one stands."));
      r.errors.push(`${name} (${where}) overlaps a confirmed stay booked here, so it was saved as an inquiry.`);
    }
    if (error) {
      r.errors.push(`${name} (${where}): couldn’t save.`);
      continue;
    }
    if (status === "cancelled") r.cancelled++;
    else if (id) r.updated++;
    else r.created++;
    if (!id) stayOf.set(g.id, "new");
  }
  return r;
}

// Out: blocked nights ----------------------------------------------------------

type PushResult = { pushed: number; freed: number; errors: string[] };

/** Stays booked in ARK OS go to the Guesty calendar as unavailable nights; cancelled ones are freed again. */
async function pushBlocks(sb: Sb, token: string, today: string): Promise<PushResult> {
  const r: PushResult = { pushed: 0, freed: 0, errors: [] };
  const { data: lots } = await sb.from("lots").select("id, guesty_listing_id").not("guesty_listing_id", "is", null);
  const listingOf = new Map((lots ?? []).map((l) => [l.id, l.guesty_listing_id as string]));
  if (!listingOf.size) return r;
  const { data: stays, error } = await sb
    .from("stays")
    .select("id, lot_id, status, kind, guest_name, check_in, check_out, updated_at, guesty_pushed_at")
    .neq("source", "guesty")
    .gte("check_out", today)
    .in("lot_id", Array.from(listingOf.keys()))
    .order("check_in");
  if (error) {
    r.errors.push("Couldn’t read stays.");
    return r;
  }
  for (const s of stays ?? []) {
    const listingId = listingOf.get(s.lot_id);
    if (!listingId) continue;
    // Our own stamp bumps updated_at a moment later, so allow a little slack.
    const changedSincePush =
      !s.guesty_pushed_at || new Date(s.updated_at).getTime() > new Date(s.guesty_pushed_at).getTime() + 10_000;
    const wantBlocked = s.status === "confirmed";
    if (wantBlocked && !changedSincePush) continue;
    if (!wantBlocked && !s.guesty_pushed_at) continue;
    const range = blockRange(s.check_in, s.check_out);
    try {
      await api(token, `/availability-pricing/api/calendar/listings/${encodeURIComponent(listingId)}`, {
        method: "PUT",
        body: wantBlocked
          ? { ...range, status: "unavailable", note: `ARK OS: ${s.kind === "guest" ? s.guest_name : s.kind === "owner" ? "owner" : "blocked"}` }
          : { ...range, status: "available", note: "" },
      });
      await sb
        .from("stays")
        .update({ guesty_pushed_at: wantBlocked ? new Date().toISOString() : null })
        .eq("id", s.id);
      if (wantBlocked) r.pushed++;
      else r.freed++;
    } catch (e) {
      r.errors.push(`${s.guest_name} (${s.check_in}): ${errorText(e)}`);
      if (e instanceof GuestyError && e.status === 429) break;
    }
    await pause(120);
  }
  return r;
}

// Runs ----------------------------------------------------------------------

export type SyncResult = {
  listings: number;
  linked: number;
  pulled: number;
  created: number;
  updated: number;
  cancelled: number;
  unmapped: number;
  pushed: number;
  errors: string[];
};

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** A full sync. Used by "Sync now" and the daily cron. */
export async function runSync(sb: Sb): Promise<SyncResult | { error: string }> {
  const i = await getIntegration(sb);
  if (!ready(i)) return { error: "Guesty isn’t connected." };
  const startedAt = new Date().toISOString();
  const today = todayIn();
  const r: SyncResult = { listings: 0, linked: 0, pulled: 0, created: 0, updated: 0, cancelled: 0, unmapped: 0, pushed: 0, errors: [] };

  let token: string;
  try {
    token = await tokenFor(sb, i);
  } catch (e) {
    await logEvent(sb, { direction: "out", kind: "test", ok: false, detail: errorText(e) });
    await sb.from("integrations").update({ last_error: errorText(e) }).eq("key", "guesty");
    return { error: errorText(e) };
  }

  // Listings first, so new reservations can find their home.
  try {
    const listings = await pullListings(token);
    await cacheListings(sb, listings);
    r.listings = listings.length;
    if (i.sync_details) r.linked = await applyDetails(sb, listings);
    const { count } = await sb.from("lots").select("id", { count: "exact", head: true }).not("guesty_listing_id", "is", null);
    await logEvent(sb, {
      direction: "in",
      kind: "sync",
      ok: true,
      detail: `Checked ${plural(listings.length, "listing")} in Guesty, ${count ?? 0} linked to homes${i.sync_details ? `, ${r.linked} updated` : ""}.`,
    });
  } catch (e) {
    r.errors.push(errorText(e));
    await logEvent(sb, { direction: "in", kind: "sync", ok: false, detail: `Listings: ${errorText(e)}` });
  }

  try {
    // Look back a little past the last sync, so nothing falls between runs.
    const since = i.last_sync_at ? new Date(new Date(i.last_sync_at).getTime() - 10 * 60_000).toISOString() : null;
    const changed = await changedReservations(token, since, today);
    const a = await absorbReservations(sb, changed);
    r.pulled = changed.length;
    r.created = a.created;
    r.updated = a.updated;
    r.cancelled = a.cancelled;
    r.unmapped = a.unmapped;
    r.errors.push(...a.errors);
    await logEvent(sb, {
      direction: "in",
      kind: "sync",
      ok: a.errors.length === 0,
      detail: `Checked ${plural(changed.length, "reservation")}: ${a.created} new, ${a.updated} updated, ${a.cancelled} cancelled${a.unmapped ? `, ${a.unmapped} for listings not linked to a home` : ""}${a.skipped ? `, ${a.skipped} skipped` : ""}.`,
    });
  } catch (e) {
    r.errors.push(errorText(e));
    await logEvent(sb, { direction: "in", kind: "sync", ok: false, detail: `Reservations: ${errorText(e)}` });
  }

  if (i.direction === "both") {
    const p = await pushBlocks(sb, token, today);
    r.pushed = p.pushed;
    r.errors.push(...p.errors);
    if (p.pushed || p.freed || p.errors.length) {
      await logEvent(sb, {
        direction: "out",
        kind: "push",
        ok: p.errors.length === 0,
        detail: `Blocked ${plural(p.pushed, "stay")} on the Guesty calendar${p.freed ? `, freed ${p.freed}` : ""}${p.errors.length ? `, ${p.errors.length} failed` : ""}.`,
      });
    }
  }

  await sb
    .from("integrations")
    .update({ last_sync_at: startedAt, last_error: r.errors[0] ?? null })
    .eq("key", "guesty");
  return r;
}

// Webhooks ------------------------------------------------------------------

/** Register ARK OS's webhook in Guesty and keep its id and signing secret. */
export async function registerWebhook(sb: Sb, url: string) {
  const i = await getIntegration(sb);
  if (!ready(i)) throw new GuestyError(400, "Connect Guesty first.");
  const token = await tokenFor(sb, i);
  const created = await api<Record<string, unknown>>(token, "/webhooks-v2", { body: { url, events: WEBHOOK_EVENTS } });
  const id = typeof created?._id === "string" ? created._id : typeof created?.id === "string" ? created.id : null;
  let secret: string | null = null;
  try {
    const s = await api<unknown>(token, "/webhooks-v2/secret");
    if (typeof s === "string") secret = s;
    else if (s && typeof s === "object") {
      const o = s as Record<string, unknown>;
      const v = o.secret ?? o.signingSecret ?? o.key;
      if (typeof v === "string") secret = v;
    }
  } catch {
    // Without the secret the address's own key still guards the webhook.
  }
  await sb
    .from("integrations")
    .update({ webhook_id: id, ...(secret ? { webhook_signing_secret: secret } : {}) })
    .eq("key", "guesty");
  return { id, signed: !!secret };
}

/** A reservation event from Guesty. v2 events carry only ids, so the reservation is fetched. */
export async function receiveWebhook(sb: Sb, body: unknown) {
  const w = parseWebhook(body);
  if (!w) {
    await logEvent(sb, { direction: "in", kind: "webhook", ok: false, detail: "A webhook arrived without a reservation id." });
    return { ok: false as const, status: 400, message: "No reservation id" };
  }
  if (w.event && !w.event.startsWith("reservation")) {
    return { ok: true as const, status: 200, message: `Ignored ${w.event}` };
  }
  let reservation = w.reservation;
  if (!reservation && w.reservationId) {
    const i = await getIntegration(sb);
    if (!ready(i)) return { ok: false as const, status: 503, message: "Guesty isn’t connected" };
    try {
      const token = await tokenFor(sb, i);
      const raw = await api<unknown>(token, `/reservations/${encodeURIComponent(w.reservationId)}?${q({ fields: RESERVATION_FIELDS })}`);
      reservation = parseReservation(raw);
    } catch (e) {
      await logEvent(sb, { direction: "in", kind: "webhook", ok: false, detail: `Couldn’t read reservation ${w.reservationId}: ${errorText(e)}` });
      return { ok: false as const, status: 502, message: errorText(e) };
    }
  }
  if (!reservation) {
    await logEvent(sb, { direction: "in", kind: "webhook", ok: false, detail: "A webhook arrived without a reservation." });
    return { ok: false as const, status: 400, message: "No reservation" };
  }
  const a = await absorbReservations(sb, [reservation]);
  const what = a.created
    ? "added to Hospitality"
    : a.updated
      ? "updated"
      : a.cancelled
        ? "cancelled"
        : a.unmapped
          ? "skipped (listing not linked to a home)"
          : "skipped";
  await logEvent(sb, {
    direction: "in",
    kind: "webhook",
    ok: a.errors.length === 0,
    detail: a.errors[0] ?? `${reservation.guestName ?? reservation.id}: ${what}.`,
  });
  return { ok: true as const, status: 200, message: what };
}
