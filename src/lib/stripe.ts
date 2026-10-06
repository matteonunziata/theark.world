import "server-only";
import Stripe from "stripe";
import { ratePrice } from "@/lib/crm";
import { fmtDate } from "@/lib/dates";
import { sendCourtEmail, sendPassEmail, sendTicketEmail, siteUrl } from "@/lib/email";
import { bookingMessage } from "@/lib/slack-format";
import { sendPortalWelcome } from "@/lib/portal-welcome";
import { notify } from "@/lib/slack";
import { paymentMessage } from "@/lib/slack-format";
import { createAdminClient } from "@/lib/supabase/admin";
import { settleShopOrder } from "@/lib/shop-order";
import { pushContact as pushToShopify } from "@/lib/shopify";

// Stripe Checkout (hosted). ARK OS makes a Checkout session for a pass, a
// membership term, a ticket or a court slot and sends the person to Stripe. When Stripe
// says it's paid (the webhook, or the return page, whichever comes first),
// public.record_stripe_payment() starts the pass or membership, marks the
// ticket paid, and adds the income to Finance. Keys live in the environment:
// STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, and SUPABASE_SERVICE_ROLE_KEY to
// record the payment.

export type PaymentKind = "pass" | "membership" | "ticket" | "court" | "shop";

let client: Stripe | null = null;

/** The Stripe client, or null until STRIPE_SECRET_KEY is set. */
export function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  client ??= new Stripe(key, { appInfo: { name: "ARK OS" } });
  return client;
}

/** Can we take payments? Needs the Stripe key and the service role key to record them. */
export const stripeReady = () => !!process.env.STRIPE_SECRET_KEY && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Test keys start sk_test_ / rk_test_. */
export const stripeLive = () => /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY ?? "");

/** Colones and dollars both have two decimals on Stripe. */
export const toMinor = (amount: number) => Math.round(amount * 100);

export const fmtAmount = (amount: number, currency: string) =>
  currency.toUpperCase() === "USD"
    ? `$${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
    : `₡${Math.round(amount).toLocaleString("en-US")}`;

/** An ISO timestamp n days back, for "last 30 days" figures. */
export const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString();

/** Months a membership term covers, or null for tiers that aren't paid by term. */
export const TERM_MONTHS: Record<string, number> = { month: 1, quarter: 3, half: 6, year: 12 };

export const TERM_NAME: Record<string, string> = {
  month: "one month",
  quarter: "three months",
  half: "six months",
  year: "a year",
};

/** One-time prices in the Stripe account, with the product they belong to. */
export type StripePrice = { priceId: string; productId: string; name: string; amount: number; currency: string };

export async function listStripePrices(): Promise<StripePrice[]> {
  const s = stripe();
  if (!s) return [];
  const out: StripePrice[] = [];
  for await (const pr of s.prices.list({ active: true, type: "one_time", expand: ["data.product"], limit: 100 })) {
    const product = pr.product;
    if (!product || typeof product === "string" || product.deleted || !product.active || pr.unit_amount == null) continue;
    out.push({
      priceId: pr.id,
      productId: product.id,
      name: pr.nickname ? `${product.name} (${pr.nickname})` : product.name,
      amount: pr.unit_amount / 100,
      currency: pr.currency.toUpperCase(),
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** The Stripe product that shares a ticket's name (Breakfast, Lunch), if there is one. */
export async function findStripePrice(name: string): Promise<StripePrice | null> {
  const n = name.trim().toLowerCase();
  if (!n) return null;
  const all = await listStripePrices();
  return all.find((p) => p.name.toLowerCase() === n) ?? all.find((p) => p.name.toLowerCase().startsWith(n)) ?? null;
}

/** Start a Checkout session and return Stripe's URL for it. */
export async function createCheckout(i: {
  kind: PaymentKind;
  /** What the person sees on Stripe, e.g. "Day pass, Tue 7 Oct". */
  title: string;
  description?: string;
  /** A price that already exists in Stripe (a product); amount and currency are then Stripe's. */
  priceId?: string | null;
  amount?: number;
  currency?: string;
  email?: string | null;
  /** Kept on the session; record_stripe_payment() reads it back. */
  meta: Record<string, string | null | undefined>;
  cancelPath: string;
}) {
  const s = stripe();
  if (!s) throw new Error("Stripe isn’t set up.");
  const origin = await siteUrl();
  const metadata: Record<string, string> = { kind: i.kind };
  for (const [k, v] of Object.entries(i.meta)) if (v) metadata[k] = v.slice(0, 500);
  if (!i.priceId && !(i.amount && i.currency)) throw new Error("Nothing to charge.");
  const session = await s.checkout.sessions.create({
    mode: "payment",
    line_items: [
      i.priceId
        ? { quantity: 1, price: i.priceId }
        : {
            quantity: 1,
            price_data: {
              currency: i.currency!.toLowerCase(),
              unit_amount: toMinor(i.amount!),
              product_data: { name: i.title, ...(i.description ? { description: i.description } : {}) },
            },
          },
    ],
    ...(i.email ? { customer_email: i.email } : {}),
    payment_intent_data: {
      description: i.title,
      metadata,
      ...(i.email ? { receipt_email: i.email } : {}),
    },
    metadata,
    success_url: `${origin}/pay/done?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: origin + i.cancelPath,
  });
  if (!session.url) throw new Error("Stripe didn’t return a checkout page.");
  return session.url;
}

export type Fulfilled =
  | {
      state: "paid";
      kind: PaymentKind;
      created: boolean;
      contactId: string | null;
      paymentId: string;
      meta: Record<string, string>;
      amount: number;
      currency: string;
    }
  | { state: "pending" | "unpaid" | "unknown" };

/**
 * Record a paid Checkout session. Safe to call more than once for the same
 * session (the database records it once). After the first recording, sends
 * what follows: the pass by email, or the portal welcome for a new member.
 */
export async function fulfillCheckout(sessionId: string): Promise<Fulfilled> {
  const s = stripe();
  const admin = createAdminClient();
  if (!s || !admin) return { state: "unknown" };
  const cs = await s.checkout.sessions.retrieve(sessionId);
  const meta = (cs.metadata ?? {}) as Record<string, string>;
  const kind = meta.kind as PaymentKind | undefined;
  if (!kind || !["pass", "membership", "ticket", "court", "shop"].includes(kind)) return { state: "unknown" };
  if (cs.payment_status === "unpaid") return { state: cs.status === "complete" ? "pending" : "unpaid" };

  const amount = (cs.amount_total ?? 0) / 100;
  const currency = (cs.currency ?? "crc").toUpperCase();
  const email = cs.customer_details?.email ?? cs.customer_email ?? meta.email ?? null;
  const intent = typeof cs.payment_intent === "string" ? cs.payment_intent : (cs.payment_intent?.id ?? null);
  if (kind === "shop") {
    // A basket paid in the member portal: its own order table, not the payments recorder.
    if (!meta.order_id) throw new Error(`Shop payment ${cs.id} has no order.`);
    const r = await settleShopOrder(admin, meta.order_id, { id: cs.id, intent });
    if (r.created) {
      await notify(
        admin,
        "payment",
        paymentMessage(
          { kind, amount: fmtAmount(amount, currency), name: meta.name || cs.customer_details?.name || null, email, description: meta.description ?? null, live: cs.livemode, contactId: r.contactId },
          await siteUrl(),
        ),
        { contact_id: r.contactId },
      );
    }
    return { state: "paid", kind, created: r.created, contactId: r.contactId, paymentId: meta.order_id, meta, amount, currency };
  }
  const { data, error } = await admin
    .rpc("record_stripe_payment", {
      p: {
        session_id: cs.id,
        payment_intent: intent,
        kind,
        email,
        name: meta.name || cs.customer_details?.name || null,
        amount,
        currency,
        contact_id: meta.contact_id ?? null,
        registration_id: meta.registration_id ?? null,
        court_player_id: meta.court_player_id ?? null,
        tier: meta.tier ?? null,
        start_date: meta.start_date ?? null,
        description: meta.description ?? null,
        live: cs.livemode,
      },
    })
    .single();
  if (error || !data) throw new Error(`Couldn’t record payment ${cs.id}: ${error?.message ?? "no result"}`);

  if (data.created && data.contact_id) {
    try {
      if (kind === "pass") await emailPass(admin, data.contact_id, data.payment_id, email);
      if (kind === "membership") await sendPortalWelcome(admin, data.contact_id);
    } catch (e) {
      console.error("After-payment email failed", cs.id, e);
    }
  }
  // A paid membership that has started gets its Shopify member tag now, not at midnight.
  if (data.created && kind === "membership" && data.contact_id) {
    await pushToShopify(admin, data.contact_id).catch((e) => console.error("Shopify push failed", cs.id, e));
  }
  if (data.created && kind === "court" && meta.token) {
    try {
      await sendCourtEmail(admin, meta.token);
    } catch (e) {
      console.error("After-payment email failed", cs.id, e);
    }
  }
  // A held booking (meals) is confirmed by the payment: the ticket goes out now.
  if (data.created && kind === "ticket" && meta.held && meta.token) {
    try {
      await emailTicketAfterPayment(admin, meta.token, fmtAmount(amount, currency));
    } catch (e) {
      console.error("After-payment ticket email failed", cs.id, e);
    }
  }
  if (data.created) {
    // Slack hears about it once, from whichever of the webhook or the return page got here first.
    await notify(
      admin,
      "payment",
      paymentMessage(
        {
          kind,
          amount: fmtAmount(amount, currency),
          name: meta.name || cs.customer_details?.name || null,
          email,
          description: meta.description ?? null,
          live: cs.livemode,
          contactId: data.contact_id,
        },
        await siteUrl(),
      ),
      { contact_id: data.contact_id },
    );
  }
  // A paid membership that has started gets its Shopify member tag now, not at midnight.
  if (data.created && kind === "membership" && data.contact_id) {
    await pushToShopify(admin, data.contact_id).catch((e) => console.error("Shopify push failed", cs.id, e));
  }
  return {
    state: "paid",
    kind,
    created: data.created,
    contactId: data.contact_id,
    paymentId: data.payment_id,
    meta,
    amount,
    currency,
  };
}

async function emailTicketAfterPayment(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  token: string,
  price: string,
) {
  const [{ data: t }, { data: org }, { data: r }] = await Promise.all([
    admin.rpc("ticket_by_token", { p_token: token }).maybeSingle(),
    admin.rpc("public_org").maybeSingle(),
    admin.from("registrations").select("email, offering_id").eq("qr_token", token).maybeSingle(),
  ]);
  if (!t || !r?.email) return;
  const orgName = org?.name ?? "The ARK";
  await sendTicketEmail({
    to: r.email,
    holder: t.holder,
    title: t.title,
    sessionDate: t.session_date,
    startTime: t.start_time,
    endTime: t.end_time,
    location: t.location,
    token,
    orgName,
  });
  const origin = await siteUrl();
  await notify(
    admin,
    "booking",
    bookingMessage(
      {
        holder: t.holder,
        title: t.title,
        date: t.session_date,
        startTime: t.start_time,
        endTime: t.end_time,
        location: t.location,
        price,
        offeringId: r.offering_id,
      },
      origin,
    ),
  );
}

/** The pass bought with a payment: what it is and when it must be used by. */
export async function passFromPayment(admin: NonNullable<ReturnType<typeof createAdminClient>>, paymentId: string) {
  const { data: m } = await admin
    .from("memberships")
    .select("tier, status, activate_by, starts_on, ends_on, tier_row:membership_tiers(name, period)")
    .eq("payment_id", paymentId)
    .maybeSingle();
  if (!m) return null;
  const tier = m.tier_row as { name: string; period: string } | null;
  return {
    name: tier?.name ?? "Pass",
    days: tier?.period === "week" ? 7 : 1,
    status: m.status,
    activateBy: m.activate_by,
    startsOn: m.starts_on,
    endsOn: m.ends_on,
  };
}

// The pass has no dates yet: it starts at the first check-in at the gate.
async function emailPass(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  contactId: string,
  paymentId: string,
  email: string | null,
) {
  const { data: c } = await admin.from("contacts").select("name, email, pass_token").eq("id", contactId).maybeSingle();
  const to = c?.email ?? email;
  if (!c || !to) return;
  const [pass, { data: org }] = await Promise.all([passFromPayment(admin, paymentId), admin.rpc("public_org").maybeSingle()]);
  if (!pass?.activateBy) return;
  const origin = await siteUrl();
  await sendPassEmail({
    to,
    name: c.name,
    what: pass.name,
    days: pass.days,
    useBy: fmtDate(pass.activateBy, { weekday: "long", month: "long", day: "numeric" }),
    url: `${origin}/p/${c.pass_token}`,
    orgName: org?.name ?? "The ARK",
  });
}

/** What a member pays for one term of their tier: their rate, less their discount. */
export function termPrice(
  tier: { price: number | null; price_ff: number | null; currency: string; period: string },
  rate: string | null | undefined,
  discountPercent: number | null | undefined,
) {
  const base = ratePrice(tier, rate);
  if (base === null || base === undefined || !TERM_MONTHS[tier.period]) return null;
  const n = Number(base) * (1 - Number(discountPercent ?? 0) / 100);
  return tier.currency === "USD" ? Math.round(n * 100) / 100 : Math.round(n);
}

/**
 * The Stripe price a pass tier charges. Uses the one saved on the tier; else
 * finds the product with the tier's name ("Day Pass") and remembers it, with
 * its amount and currency. Null when Stripe has no such product.
 */
export async function passStripePrice(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  tier: { key: string; name: string; price: number | null; currency: string; stripe_price_id: string | null },
): Promise<{ priceId: string; amount: number; currency: string } | null> {
  if (tier.stripe_price_id) {
    return { priceId: tier.stripe_price_id, amount: Number(tier.price ?? 0), currency: tier.currency };
  }
  const found = await findStripePrice(tier.name).catch(() => null);
  if (!found) return null;
  await admin
    .from("membership_tiers")
    .update({ stripe_price_id: found.priceId, price: found.amount, currency: found.currency })
    .eq("key", tier.key);
  return { priceId: found.priceId, amount: found.amount, currency: found.currency };
}
