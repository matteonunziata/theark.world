// How a Guesty reservation or listing looks to ARK OS. Pure functions, no
// network, so they're easy to test. The server side is in guesty.ts.

import { createHmac, timingSafeEqual } from "node:crypto";

/** A Guesty reservation, in the shape a stay needs. */
export type ReservationIn = {
  id: string;
  listingId: string | null;
  guestId: string | null;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  guestName: string | null;
  email: string | null;
  phone: string | null;
  guests: number | null;
  total: number | null;
  currency: string | null;
  paid: boolean | null;
  channel: string | null;
  confirmationCode: string | null;
  updatedAt: string | null;
};

/** A Guesty listing, as cached in guesty_listings. */
export type ListingIn = {
  id: string;
  title: string;
  nickname: string | null;
  active: boolean;
  listed: boolean;
  accommodates: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  beds: number | null;
  base_price: number | null;
  currency: string | null;
  cleaning_fee: number | null;
  min_nights: number | null;
  check_in_time: string | null;
  check_out_time: string | null;
  cover_url: string | null;
};

/** The reservation fields we ask Guesty for. */
export const RESERVATION_FIELDS =
  "_id status checkInDateLocalized checkOutDateLocalized listingId guestId guest money source platform confirmationCode guestsCount numberOfGuests lastUpdatedAt";

/** The listing fields we ask Guesty for. */
export const LISTING_FIELDS =
  "title nickname active isListed accommodates bedrooms bathrooms beds prices terms defaultCheckInTime defaultCheckOutTime picture";

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null);
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const day = (v: unknown) => {
  const s = str(v);
  if (!s) return null;
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};

/** Guesty's reservation status, as an ARK OS stay status. Unknown statuses are left out. */
export function stayStatus(status: string | null): "inquiry" | "confirmed" | "cancelled" | null {
  switch ((status ?? "").toLowerCase()) {
    case "confirmed":
    case "checked_in":
    case "checked_out":
      return "confirmed";
    case "inquiry":
    case "reserved":
    case "awaiting_payment":
      return "inquiry";
    case "canceled":
    case "cancelled":
    case "declined":
    case "expired":
    case "closed":
      return "cancelled";
    default:
      return null;
  }
}

/** "airbnb2" → "Airbnb", "bookingCom" → "Booking.com", "manual" → "Guesty". */
export function channelLabel(platform: string | null, source: string | null) {
  const p = (platform ?? source ?? "").toLowerCase();
  if (!p) return null;
  if (p.includes("engine") || p.includes("website") || p === "direct") return "Booking site";
  if (p.includes("airbnb")) return "Airbnb";
  if (p.includes("booking")) return "Booking.com";
  if (p.includes("vrbo") || p.includes("homeaway")) return "Vrbo";
  if (p.includes("expedia")) return "Expedia";
  if (p.includes("tripadvisor")) return "Tripadvisor";
  if (p === "manual") return "Guesty";
  return (platform ?? source ?? "").trim() || null;
}

/** A reservation from the API or a legacy webhook, in the shape we care about. */
export function parseReservation(raw: unknown): ReservationIn | null {
  const r = obj(raw);
  if (!r) return null;
  const id = str(r._id) ?? str(r.id) ?? str(r.reservationId);
  if (!id) return null;
  const guest = obj(r.guest);
  const money = obj(r.money);
  const nog = obj(r.numberOfGuests);
  const guestsCount =
    num(r.guestsCount) ??
    (nog ? (num(nog.numberOfAdults) ?? 0) + (num(nog.numberOfChildren) ?? 0) : null);
  const listing = obj(r.listing);
  const paid =
    typeof money?.isFullyPaid === "boolean"
      ? money.isFullyPaid
      : num(money?.balanceDue) !== null
        ? num(money?.balanceDue) === 0
        : null;
  const name = str(guest?.fullName) ?? [str(guest?.firstName), str(guest?.lastName)].filter(Boolean).join(" ") ?? null;
  return {
    id,
    listingId: str(r.listingId) ?? str(listing?._id) ?? null,
    guestId: str(r.guestId) ?? str(guest?._id) ?? null,
    status: (str(r.status) ?? "").toLowerCase(),
    checkIn: day(r.checkInDateLocalized) ?? day(r.checkinDateLocalized) ?? day(r.checkIn),
    checkOut: day(r.checkOutDateLocalized) ?? day(r.checkoutDateLocalized) ?? day(r.checkOut),
    guestName: name || null,
    email: str(guest?.email)?.toLowerCase() ?? null,
    phone: str(guest?.phone) ?? null,
    guests: guestsCount && guestsCount > 0 ? guestsCount : null,
    total: num(money?.totalPrice) ?? num(money?.hostPayout) ?? null,
    currency: str(money?.currency)?.toUpperCase() ?? null,
    paid,
    channel: channelLabel(str(r.platform), str(r.source)),
    confirmationCode: str(r.confirmationCode),
    updatedAt: str(r.lastUpdatedAt) ?? str(r.updatedAt),
  };
}

/** A listing from GET /listings. */
export function parseListing(raw: unknown): ListingIn | null {
  const l = obj(raw);
  if (!l) return null;
  const id = str(l._id) ?? str(l.id);
  if (!id) return null;
  const prices = obj(l.prices);
  const terms = obj(l.terms);
  const picture = obj(l.picture);
  const title = str(l.title) ?? str(l.nickname) ?? id;
  return {
    id,
    title,
    nickname: str(l.nickname),
    active: l.active !== false,
    listed: l.isListed !== false,
    accommodates: num(l.accommodates),
    bedrooms: num(l.bedrooms),
    bathrooms: num(l.bathrooms),
    beds: num(l.beds),
    base_price: num(prices?.basePrice),
    currency: str(prices?.currency)?.toUpperCase() ?? null,
    cleaning_fee: num(prices?.cleaningFee),
    min_nights: num(terms?.minNights),
    check_in_time: str(l.defaultCheckInTime),
    check_out_time: str(l.defaultCheckOutTime),
    cover_url: str(picture?.original) ?? str(picture?.large) ?? str(picture?.thumbnail) ?? null,
  };
}

/** A v2 webhook body: which reservation changed, and whether the body already carries it. */
export function parseWebhook(raw: unknown): { event: string; reservationId: string | null; reservation: ReservationIn | null } | null {
  const b = obj(raw);
  if (!b) return null;
  const event = str(b.event) ?? str(b.eventType) ?? "";
  const data = obj(b.data);
  const legacy = obj(b.reservation);
  const reservation = legacy ? parseReservation(legacy) : null;
  const reservationId = str(data?.reservationId) ?? str(data?._id) ?? reservation?.id ?? str(b.reservationId) ?? null;
  if (!event && !reservationId) return null;
  return { event, reservationId, reservation };
}

/** The calendar range a stay blocks: Guesty counts nights, so the last night is the day before check-out. */
export function blockRange(checkIn: string, checkOut: string) {
  const d = new Date(`${checkOut}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return { startDate: checkIn, endDate: d.toISOString().slice(0, 10) };
}

/** "15:00" or "15:00:00" → "15:00:00"; anything else → null. */
export function timeOfDay(v: string | null) {
  if (!v) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(v.trim());
  if (!m) return null;
  const h = Number(m[1]);
  if (h > 23 || Number(m[2]) > 59) return null;
  return `${String(h).padStart(2, "0")}:${m[2]}:00`;
}

/**
 * Guesty signs v2 webhooks the Svix way: HMAC-SHA256 over "id.timestamp.body"
 * with the secret after "whsec_" (base64), compared with each "v1,…" entry in
 * svix-signature. Timestamps older than five minutes are refused.
 */
export function verifySignature(
  secret: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  body: string,
  now = Date.now(),
) {
  if (!headers.id || !headers.timestamp || !headers.signature) return false;
  const ts = Number(headers.timestamp);
  if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > 300) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${headers.id}.${headers.timestamp}.${body}`).digest();
  return headers.signature.split(/\s+/).some((part) => {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) return false;
    const given = Buffer.from(sig, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}
