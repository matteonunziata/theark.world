"use server";

import { revalidatePath } from "next/cache";
import {
  type ActionResult,
  fail,
  field,
  friendly,
  ok,
} from "@/lib/action-result";
import { staffOrThrow } from "@/lib/auth";
import { fmtDate, todayIn } from "@/lib/dates";
import { sendEmail, sendPassEmail, siteUrl } from "@/lib/email";
import { listStripePrices, termPrice } from "@/lib/stripe";
import { ratePrice } from "@/lib/crm";
import { chargeSavedCard, tilopayReady } from "@/lib/tilopay";

const PERIODS = ["day", "week", "month", "quarter", "half", "year", "once"];

export async function saveTier(
  _prev: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin");
  const existing = field(data, "key");
  const name = field(data, "name");
  if (!name) return fail("Enter a name.");

  if (data.get("intent") === "delete" && existing) {
    const { error } = await supabase.from("membership_tiers").delete().eq("key", existing);
    if (error) return fail(friendly(error));
    revalidatePath("/memberships", "layout");
    return ok("Tier removed");
  }

  const price = field(data, "price");
  const priceFf = field(data, "price_ff");
  const spots = Number(field(data, "spots") ?? 0);
  const period = field(data, "period") ?? "month";
  const row = {
    name,
    price: price === null ? null : Math.max(0, Number(price)),
    price_ff: priceFf === null ? null : Math.max(0, Number(priceFf)),
    guest_passes: Math.max(0, Math.min(99, Math.floor(Number(field(data, "guest_passes") ?? 0)) || 0)),
    court_discount: Math.max(0, Math.min(100, Number(field(data, "court_discount") ?? 0) || 0)),
    currency: field(data, "currency") === "USD" ? "USD" : "CRC",
    period: PERIODS.includes(period) ? period : "month",
    spots: spots > 0 ? spots : null,
    description: field(data, "description"),
    pause_rule: field(data, "pause_rule"),
    perks: (field(data, "perks") ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
    active: data.get("active") !== "no",
  };
  // A Stripe product sets the price; the amount shown everywhere is Stripe's.
  const stripePriceId = field(data, "stripe_price_id");
  if (stripePriceId) {
    const sp = (await listStripePrices().catch(() => [])).find((x) => x.priceId === stripePriceId);
    if (!sp) return fail("That Stripe product isn’t available any more. Pick another.");
    row.price = sp.amount;
    row.currency = sp.currency === "USD" ? "USD" : "CRC";
  }
  const { error } = existing
    ? await supabase.from("membership_tiers").update({ ...row, stripe_price_id: stripePriceId }).eq("key", existing)
    : await supabase.from("membership_tiers").insert({
        ...row,
        stripe_price_id: stripePriceId,
        key: name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "tier",
        position: 99,
      });
  if (error) {
    if (error.code === "23505") return fail("A tier with that name already exists.");
    return fail(friendly(error));
  }
  revalidatePath("/memberships", "layout");
  revalidatePath("/crm", "layout");
  return ok(existing ? "Tier saved" : `${name} added`);
}

export async function saveDiscount(
  _prev: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin");
  const id = field(data, "id");
  if (data.get("intent") === "delete" && id) {
    const { error } = await supabase.from("discounts").delete().eq("id", id);
    if (error) return fail(friendly(error));
    revalidatePath("/memberships", "layout");
    return ok("Discount removed");
  }
  const name = field(data, "name");
  const percent = Number(field(data, "percent") ?? 0);
  if (!name) return fail("Enter a name.");
  if (!(percent > 0 && percent <= 100)) return fail("Enter a percentage between 1 and 100.");
  const row = {
    name,
    percent,
    lifetime: data.get("lifetime") === "yes",
    description: field(data, "description"),
    active: data.get("active") !== "no",
  };
  const { error } = id
    ? await supabase.from("discounts").update(row).eq("id", id)
    : await supabase.from("discounts").insert(row);
  if (error) return fail(friendly(error));
  revalidatePath("/memberships", "layout");
  revalidatePath("/crm", "layout");
  return ok(id ? "Discount saved" : `${name} added`);
}

const REVIEW = ["new", "reviewing", "approved", "declined"];

/**
 * Approving an application sends the applicant a free day pass: the one made
 * when they applied if there is one, otherwise a new one. Skips a pass that has
 * already been used. Never throws: the approval itself has already gone through.
 */
async function sendApprovalPass(
  supabase: Awaited<ReturnType<typeof staffOrThrow>>["supabase"],
  id: string,
): Promise<boolean> {
  const { data: a } = await supabase
    .from("membership_applications")
    .select("contact_id, free_pass_id, contact:contacts(name, email, pass_token)")
    .eq("id", id)
    .maybeSingle();
  if (!a?.contact?.email) return false;

  let passId = a.free_pass_id;
  let activateBy: string | null = null;
  if (passId) {
    const { data: pass } = await supabase
      .from("memberships")
      .select("status, activate_by")
      .eq("id", passId)
      .maybeSingle();
    if (!pass || pass.status !== "unused" || !pass.activate_by) return false;
    activateBy = pass.activate_by;
  } else {
    const d = new Date(`${todayIn()}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 90);
    activateBy = d.toISOString().slice(0, 10);
    const { data: made, error } = await supabase
      .from("memberships")
      .insert({ contact_id: a.contact_id, tier: "day", status: "unused", activate_by: activateBy, source: "application" })
      .select("id")
      .single();
    if (error) {
      console.error("Approval pass failed", error);
      return false;
    }
    passId = made.id;
    await supabase.from("membership_applications").update({ free_pass_id: passId }).eq("id", id);
  }

  const [origin, { data: org }] = await Promise.all([siteUrl(), supabase.rpc("public_org").maybeSingle()]);
  return sendPassEmail({
    to: a.contact.email,
    name: a.contact.name,
    what: "Day Pass",
    days: 1,
    useBy: fmtDate(activateBy, { weekday: "long", month: "long", day: "numeric" }),
    url: `${origin}/p/${a.contact.pass_token}`,
    orgName: org?.name ?? "The ARK",
    free: true,
  });
}

/** Approve, decline or reopen a membership application (public.review_application). */
export async function reviewApplication(id: string, status: string): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin", "lead", "sales", "community_manager");
  if (!REVIEW.includes(status)) return fail("Unknown status.");
  const { error } = await supabase.rpc("review_application", { p_id: id, p_status: status });
  if (error) return fail(friendly(error));
  let sent = false;
  if (status === "approved") {
    try {
      sent = await sendApprovalPass(supabase, id);
    } catch (e) {
      console.error("Approval pass email failed", e);
    }
  }
  revalidatePath("/memberships", "layout");
  revalidatePath("/crm", "layout");
  if (status === "approved") return ok(sent ? "Approved. Day pass sent" : "Approved");
  return ok(status === "declined" ? "Declined" : "Updated");
}

/** Give an existing contact (or team member) a tier from the Members page. */
type Quote = { amount: number; currency: string; name: string };

/** What this tier costs this person: their rate, less their discount. Passes cost the tier's price. */
async function priceFor(
  supabase: Awaited<ReturnType<typeof staffOrThrow>>["supabase"],
  contactId: string | null,
  tierKey: string,
): Promise<Quote | null> {
  const { data: t } = await supabase
    .from("membership_tiers")
    .select("name, price, price_ff, currency, period")
    .eq("key", tierKey)
    .maybeSingle();
  if (!t) return null;
  const { data: c } = contactId
    ? await supabase.from("contacts").select("rate, discount:discounts(percent, active)").eq("id", contactId).maybeSingle()
    : { data: null };
  const percent = c?.discount?.active ? Number(c.discount.percent) : 0;
  const tier = { ...t, price: t.price === null ? null : Number(t.price), price_ff: t.price_ff === null ? null : Number(t.price_ff) };
  const amount =
    t.period === "day" || t.period === "week"
      ? Number(ratePrice(tier, c?.rate) ?? 0)
      : (termPrice(tier, c?.rate, percent) ?? Number(ratePrice(tier, c?.rate) ?? 0));
  return amount > 0 ? { amount, currency: t.currency, name: t.name } : null;
}

/** The price shown in the drawer once a person and a tier are chosen. */
export async function quoteTier(contactId: string | null, tierKey: string): Promise<Quote | null> {
  const { supabase } = await staffOrThrow("admin", "lead", "sales", "community_manager");
  if (!tierKey) return null;
  return priceFor(supabase, contactId, tierKey);
}

const PAY = ["none", "link", "tilopay_account", "bac_card", "sinpe", "cash"] as const;
type Pay = (typeof PAY)[number];

export async function addMember(
  _prev: ActionResult,
  data: FormData,
): Promise<ActionResult> {
  const { supabase } = await staffOrThrow("admin", "lead", "sales", "community_manager");
  const isNew = field(data, "mode") === "new";
  let contact = field(data, "contact_id");
  const tier = field(data, "tier");
  const starts = field(data, "starts");
  const ends = field(data, "ends");
  const photo = field(data, "photo_path");
  const pay = (field(data, "pay") ?? "none") as Pay;
  const reference = field(data, "reference");
  let email = field(data, "email")?.toLowerCase() ?? null;
  if (!PAY.includes(pay)) return fail("Choose how they pay.");
  if (isNew) {
    if (!field(data, "first_name")) return fail("Enter a first name.");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Enter a valid email.");
  } else if (!contact) {
    return fail("Search for a person first.");
  }
  if (!tier) return fail("Choose a tier.");
  // Every pass carries a photo: a new one now, or one the person already has.
  if (!photo) {
    if (isNew) return fail("Add a photo of the person.");
    const { data: c } = await supabase.from("contacts").select("photo_path").eq("id", contact!).maybeSingle();
    if (!c?.photo_path) return fail("Add a photo of the person.");
  }

  // Check the payment before anyone is created or charged.
  const quote = pay === "none" ? null : await priceFor(supabase, isNew ? null : contact, tier);
  if (pay !== "none" && !quote) return fail("This tier has no price set. Choose “No charge” or set the price in Tiers & pricing.");
  if ((pay === "bac_card" || pay === "sinpe") && !reference) {
    return fail(pay === "sinpe" ? "Enter the SINPE reference number." : "Enter the authorization code from the receipt.");
  }
  if (pay === "tilopay_account") {
    if (isNew) return fail("A new person has no saved card. Choose another way to pay.");
    if (!tilopayReady()) return fail("Pay with account isn’t set up yet.");
  }
  if (pay === "link" && isNew && !email) return fail("Enter their email to send the payment link.");

  if (isNew) {
    const { data: id, error } = await supabase.rpc("add_member_contact", {
      p_first: field(data, "first_name")!,
      p_last: field(data, "last_name"),
      p_phone: field(data, "phone"),
      p_email: email,
    });
    if (error || !id) return fail(friendly(error));
    contact = id;
  }
  if (photo) {
    const { error } = await supabase.rpc("set_contact_photo", { p_contact: contact!, p_path: photo });
    if (error) return fail(friendly(error));
  }

  const future = !!starts && starts > todayIn();
  const status = future ? "upcoming" : "active";
  const done = (what: string) => {
    revalidatePath("/memberships", "layout");
    revalidatePath("/crm", "layout");
    return ok(what);
  };

  if (pay === "link") {
    // The membership starts when the payment comes in.
    const { data: c } = await supabase.from("contacts").select("name, email, pay_token").eq("id", contact!).maybeSingle();
    email = c?.email ?? null;
    if (!email || !c) return fail("This person has no email. Add one in the CRM, then send the link.");
    const origin = await siteUrl();
    const url = `${origin}/pay/join/${c.pay_token}?tier=${encodeURIComponent(tier)}`;
    const amount = `${quote!.currency === "USD" ? "$" : "₡"}${quote!.amount.toLocaleString("en-US")}`;
    const first = c.name.trim().split(/\s+/)[0];
    const sent = await sendEmail({
      to: email,
      subject: `Pay for your ${quote!.name} at The ARK`,
      parts: {
        eyebrow: "Payment link",
        heading: quote!.name,
        body: `<p style="margin:0 0 16px">Hi ${first.replace(/[<>&"]/g, "")}, here is your link to pay ${amount} for your ${quote!.name}. It starts as soon as the payment goes through.</p>`,
        cta: { label: "Pay now", href: url },
        footnote: "You’ll pay on Stripe. If you didn’t expect this email, you can ignore it.",
      },
      text: `Pay ${amount} for your ${quote!.name} at The ARK: ${url}`,
    });
    if (!sent) return fail(`Email isn’t set up, or it couldn’t be sent. Their payment link is ${url}`);
    return done(`Payment link sent to ${email}`);
  }

  if (pay === "none") {
    const { error } = await supabase.rpc("set_membership", {
      p_contact: contact!,
      p_tier: tier,
      p_status: status,
      p_starts: starts,
      p_ends: ends,
    });
    if (error) return fail(friendly(error));
    return done(isNew ? "Person and membership added" : "Member added");
  }

  let ref = reference;
  if (pay === "tilopay_account") {
    const { data: token } = await supabase.rpc("checkout_card_token", { cid: contact! });
    if (!token) return fail("This person has no saved card.");
    const charge = await chargeSavedCard(token, quote!.amount, crypto.randomUUID());
    if (!charge.ok) return fail(charge.error);
    ref = charge.transactionId;
  }
  const { error } = await supabase.rpc("issue_paid_membership", {
    p_contact: contact!,
    p_tier: tier,
    p_status: status,
    p_starts: starts,
    p_ends: ends,
    p_method: pay === "sinpe" ? "sinpe" : pay === "cash" ? "cash" : "card",
    p_reference: ref,
    p_amount: quote!.amount,
    p_currency: quote!.currency,
  });
  if (error) {
    if (pay === "tilopay_account") {
      console.error("Memberships: Tilopay charged but membership failed", ref, error);
      return fail(`The card was charged (Tilopay ${ref}) but the membership couldn’t be saved. Don’t charge again; tell an admin.`);
    }
    return fail(friendly(error));
  }
  return done("Paid and added");
}
