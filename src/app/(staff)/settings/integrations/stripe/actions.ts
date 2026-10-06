"use server";

import { revalidatePath } from "next/cache";
import type Stripe from "stripe";
import { staffOrThrow } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { crDay, guessLine, IMPORTABLE } from "@/lib/stripe-import-map";
import { createAdminClient } from "@/lib/supabase/admin";

// Import past Stripe payments, one page of charges (newest first) per call.
// The page calls this again with `next` until Stripe has no more. Every
// charge is recorded once by public.import_stripe_charge(), so running the
// import again only adds what's new.

export type ImportBatch =
  | {
      ok: true;
      seen: number;
      imported: number;
      skipped: number;
      linked: number;
      otherCurrency: number;
      failed: number;
      firstError: string | null;
      /** Oldest day reached so far, for the progress line. */
      oldest: string | null;
      next: string | null;
    }
  | { ok: false; error: string };

/** Charges made through ARK OS's own checkout carry one of these; they're recorded already. */
const OWN_KINDS = new Set(["pass", "membership", "ticket", "court"]);

const PAGE = 100;
const AT_ONCE = 8;

const idOf = (x: string | { id: string } | null | undefined) => (typeof x === "string" ? x : (x?.id ?? null));

export async function importStripeBatch(after: string | null): Promise<ImportBatch> {
  try {
    await staffOrThrow("admin");
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Only admins can import." };
  }
  const s = stripe();
  const admin = createAdminClient();
  if (!s || !admin) return { ok: false, error: "Stripe isn’t connected (STRIPE_SECRET_KEY and SUPABASE_SERVICE_ROLE_KEY)." };

  let page: Stripe.ApiList<Stripe.Charge>;
  try {
    page = await s.charges.list({
      limit: PAGE,
      ...(after ? { starting_after: after } : {}),
      expand: ["data.customer", "data.balance_transaction"],
    });
  } catch (e) {
    return { ok: false, error: `Stripe said: ${e instanceof Error ? e.message : "couldn’t list payments"}` };
  }

  const r = { seen: page.data.length, imported: 0, skipped: 0, linked: 0, otherCurrency: 0, failed: 0 };
  let firstError: string | null = null;

  const one = async (c: Stripe.Charge) => {
    if (c.status !== "succeeded" || !c.paid || c.captured === false) return void r.skipped++;
    if (c.metadata?.kind && OWN_KINDS.has(c.metadata.kind)) return void r.skipped++;
    if (!IMPORTABLE.has(c.currency)) return void r.otherCurrency++;

    const customer = c.customer && typeof c.customer === "object" && !("deleted" in c.customer && c.customer.deleted)
      ? (c.customer as Stripe.Customer)
      : null;
    const email = c.billing_details?.email || c.receipt_email || customer?.email || null;
    const name = c.billing_details?.name || customer?.name || null;
    const description = c.description || c.calculated_statement_descriptor || null;
    const guess = guessLine([c.description, c.calculated_statement_descriptor, ...Object.values(c.metadata ?? {})].join(" "));
    const bt = c.balance_transaction && typeof c.balance_transaction === "object" ? c.balance_transaction : null;

    let refunds: { id: string; amount: number; refunded_on: string; refunded_at: string }[] = [];
    if (c.amount_refunded > 0) {
      const list = await s.refunds.list({ charge: c.id, limit: 100 });
      refunds = list.data
        .filter((x) => x.status !== "failed" && x.status !== "canceled")
        .map((x) => ({
          id: x.id,
          amount: x.amount / 100,
          refunded_on: crDay(x.created),
          refunded_at: new Date(x.created * 1000).toISOString(),
        }));
    }

    const { data, error } = await admin.rpc("import_stripe_charge", {
      p: {
        charge_id: c.id,
        payment_intent: idOf(c.payment_intent),
        email,
        name,
        amount: c.amount / 100,
        currency: c.currency,
        paid_at: new Date(c.created * 1000).toISOString(),
        paid_on: crDay(c.created),
        description,
        line: guess.line,
        category: guess.category,
        fee: bt ? bt.fee / 100 : 0,
        fee_currency: bt?.currency ?? null,
        live: c.livemode,
        refunds,
      },
    });
    if (error) throw new Error(error.message);
    const res = data as { status?: string; linked?: boolean } | null;
    if (res?.status === "imported") {
      r.imported++;
      if (res.linked) r.linked++;
    } else r.skipped++;
  };

  for (let i = 0; i < page.data.length; i += AT_ONCE) {
    const settled = await Promise.allSettled(page.data.slice(i, i + AT_ONCE).map(one));
    for (const x of settled) {
      if (x.status === "rejected") {
        r.failed++;
        firstError ??= x.reason instanceof Error ? x.reason.message : String(x.reason);
      }
    }
  }

  const last = page.data.at(-1);
  if (!page.has_more) revalidatePath("/finance", "layout");
  revalidatePath("/settings/integrations", "layout");
  return {
    ok: true,
    ...r,
    firstError,
    oldest: last ? crDay(last.created) : null,
    next: page.has_more && last ? last.id : null,
  };
}
