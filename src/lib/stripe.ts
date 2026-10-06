import "server-only";
import Stripe from "stripe";
import { ratePrice } from "@/lib/crm";
import { fmtDate } from "@/lib/dates";
import { sendPassEmail, siteUrl } from "@/lib/email";
import { sendPortalWelcome } from "@/lib/portal-welcome";
import { notify } from "@/lib/slack";
import { paymentMessage } from "@/lib/slack-format";
import { createAdminClient } from "@/lib/supabase/admin";

// Stripe Checkout (hosted). ARK OS makes a Checkout session for a pass, a
// membership term or a ticket and sends the person to Stripe. When Stripe
// says it's paid (the webhook, or the return page, whichever comes first),
// public.record_stripe_payment() starts the pass or membership, marks the
// ticket paid, and adds the income to Finance. Keys live in the environment:
// STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, and SUPABASE_SERVICE_ROLE_KEY to
// record the payment.

export type PaymentKind = "pass" | "membership" | "ticket";

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

/** Start a Checkout session and return Stripe's URL for it. */
export async function createCheckout(i: {
  kind: PaymentKind;
  /** What the person sees on Stripe, e.g. "Day pass, Tue 7 Oct". */
  title: string;
  description?: string;
  amount: number;
  currency: string;
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
  const session = await s.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: i.currency.toLowerCase(),
          unit_amount: toMinor(i.amount),
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
  | { state: "paid"; kind: PaymentKind; created: boolean; contactId: string | null; meta: Record<string, string>; amount: number; currency: string }
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
  if (!kind || !["pass", "membership", "ticket"].includes(kind)) return { state: "unknown" };
  if (cs.payment_status === "unpaid") return { state: cs.status === "complete" ? "pending" : "unpaid" };

  const amount = (cs.amount_total ?? 0) / 100;
  const currency = (cs.currency ?? "crc").toUpperCase();
  const email = cs.customer_details?.email ?? cs.customer_email ?? meta.email ?? null;
  const intent = typeof cs.payment_intent === "string" ? cs.payment_intent : (cs.payment_intent?.id ?? null);
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
      if (kind === "pass") await emailPass(admin, data.contact_id, email);
      if (kind === "membership") await sendPortalWelcome(admin, data.contact_id);
    } catch (e) {
      console.error("After-payment email failed", cs.id, e);
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
  return { state: "paid", kind, created: data.created, contactId: data.contact_id, meta, amount, currency };
}

async function emailPass(admin: NonNullable<ReturnType<typeof createAdminClient>>, contactId: string, email: string | null) {
  const { data: c } = await admin
    .from("contacts")
    .select("name, email, tier, member_since, renews_on, pass_token, membership_status")
    .eq("id", contactId)
    .maybeSingle();
  const to = c?.email ?? email;
  if (!c || !to) return;
  const [{ data: tier }, { data: org }] = await Promise.all([
    admin.from("membership_tiers").select("name, period").eq("key", c.tier ?? "").maybeSingle(),
    admin.rpc("public_org").maybeSingle(),
  ]);
  const origin = await siteUrl();
  const day = (d: string | null) => (d ? fmtDate(d, { weekday: "long", month: "long", day: "numeric" }) : "");
  await sendPassEmail({
    to,
    name: c.name,
    what: tier?.name ?? "Your pass",
    from: day(c.member_since),
    until: c.renews_on && c.renews_on !== c.member_since ? day(c.renews_on) : null,
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
