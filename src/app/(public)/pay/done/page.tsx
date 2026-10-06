import type { Metadata } from "next";
import Link from "next/link";
import { PortalHead } from "@/components/portal-head";
import { getViewer } from "@/lib/auth";
import { fmtDate } from "@/lib/dates";
import { emailConfigured } from "@/lib/email";
import { type Fulfilled, fmtAmount, fulfillCheckout, passFromPayment } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Payment", robots: { index: false } };

const PROBLEMS: Record<string, [string, string]> = {
  off: ["Online payment isn’t open yet", "Please pay at reception, or reply to the message you got from us."],
  member: ["We couldn’t find that membership", "The link may be incomplete. Ask us for a new one."],
  email: ["We need your email first", "Ask us to add your email to your membership, then try the link again."],
  tier: ["There’s nothing to pay online here", "This membership doesn’t have a price for online payment. We’ll sort it out with you directly."],
  stripe: ["We couldn’t open the payment page", "Nothing was charged. Try again in a minute."],
};

const day = (d: string | null | undefined) =>
  d ? fmtDate(d, { weekday: "long", month: "long", day: "numeric" }) : "";

export default async function PaymentDone({ searchParams }: PageProps<"/pay/done">) {
  const sp = await searchParams;
  const sessionId = typeof sp.session_id === "string" ? sp.session_id : "";
  const code = typeof sp.problem === "string" ? sp.problem : "";
  const { supabase } = await getViewer();
  const { data: org } = await supabase.rpc("public_org").maybeSingle();
  const orgName = org?.name ?? "The ARK";
  const head = <PortalHead name={orgName} sub="Payment" />;

  const box = (state: string, cls: string, title: string, body: React.ReactNode) => (
    <>
      {head}
      <div className="p-body">
        <div className="ticket">
          <span className={`state ${cls}`}>{state}</span>
          <h1>{title}</h1>
          {body}
        </div>
      </div>
    </>
  );

  if (!sessionId) {
    const [title, text] = PROBLEMS[code] ?? PROBLEMS.stripe;
    return box("Not paid", "bad", title, (
      <>
        <p className="muted">{text}</p>
        <p><Link className="btn" href="/ark-membership">Back to The ARK</Link></p>
      </>
    ));
  }

  // Record it now, in case the webhook hasn't come in yet. It's recorded once either way.
  let r: Fulfilled = { state: "unknown" };
  try {
    r = await fulfillCheckout(sessionId);
  } catch (e) {
    console.error("Return page couldn't record payment", sessionId, e);
  }

  if (r.state === "pending") {
    return box("Processing", "soon", "Your payment is on its way", (
      <p className="muted">Your bank is still confirming it. We’ll email you as soon as it clears; there’s nothing more to do.</p>
    ));
  }
  if (r.state !== "paid") {
    return box("Checking", "soon", "We’re confirming your payment", (
      <p className="muted">
        If you were charged, it will show up with us shortly and your receipt from Stripe is in your inbox. If anything
        looks wrong, reply to that receipt and we’ll sort it out.
      </p>
    ));
  }

  const paid = `${fmtAmount(r.amount, r.currency)} paid.`;
  const admin = createAdminClient();
  const contact =
    admin && r.contactId
      ? (
          await admin
            .from("contacts")
            .select("name, pass_token, member_since, renews_on, tier, membership_status")
            .eq("id", r.contactId)
            .maybeSingle()
        ).data
      : null;
  const first = (contact?.name ?? r.meta.name ?? "").trim().split(/\s+/)[0];

  if (r.kind === "ticket") {
    return box("Paid", "ok", `Thank you${first ? `, ${first}` : ""}`, (
      <>
        <p className="muted">{paid} Your ticket is ready; show it to security when you arrive.</p>
        {r.meta.token && <p><Link className="btn primary" href={`/t/${r.meta.token}`}>View your ticket</Link></p>}
      </>
    ));
  }

  if (r.kind === "court") {
    return box("Paid", "ok", `See you on court${first ? `, ${first}` : ""}`, (
      <>
        <p className="muted">
          {paid} Your court is booked.{emailConfigured() ? " The details are in your inbox too." : ""}
        </p>
        {r.meta.token && <p><Link className="btn primary" href={`/courts/b/${r.meta.token}`}>Open your booking</Link></p>}
      </>
    ));
  }

  if (r.kind === "pass") {
    const pass = admin ? await passFromPayment(admin, r.paymentId) : null;
    const covers = pass?.days === 7 ? "seven days in a row" : "one day";
    return box("Paid", "ok", `See you soon${first ? `, ${first}` : ""}`, (
      <>
        <p className="muted">
          {paid} Your {pass?.name.toLowerCase() ?? "pass"} covers {covers}, 8am to 8pm, starting the moment security checks
          you in{pass?.activateBy ? `. Use it by ${day(pass.activateBy)}` : ""}.{" "}
          {emailConfigured() ? "We’ve emailed it to you too." : "Keep this page, or save the pass to your photos."}
        </p>
        {contact?.pass_token && (
          <p><Link className="btn primary" href={`/p/${contact.pass_token}`}>Open your pass</Link></p>
        )}
      </>
    ));
  }

  return box("Paid", "ok", `Welcome${first ? `, ${first}` : ""}`, (
    <>
      <p className="muted">
        {paid} Your membership is active{contact?.renews_on ? ` until ${day(contact.renews_on)}` : ""}.
        {emailConfigured() ? " Check your inbox for your way into the members portal." : ""}
      </p>
      <p><Link className="btn primary" href="/portal">Go to the members portal</Link></p>
    </>
  ));
}
