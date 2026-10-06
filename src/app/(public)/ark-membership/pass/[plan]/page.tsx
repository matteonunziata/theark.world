/* eslint-disable @next/next/no-img-element -- the logo is a static file */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArkFonts } from "@/components/ark-fonts";
import { stripeReady } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { money, PLANS } from "../../plans";
import { PassForm } from "../pass-form";
import "../../membership.css";

export const metadata: Metadata = {
  title: { absolute: "Buy a pass — The ARK, Santa Teresa" },
  description: "Day and week passes to The ARK in Santa Teresa, Costa Rica. No application needed.",
};

export default async function PassPage({ params }: PageProps<"/ark-membership/pass/[plan]">) {
  const { plan } = await params;
  const passes = PLANS.filter((p) => p.kind === "pass");
  const asked = passes.find((p) => p.key === plan);
  if (!asked) notFound();
  // Until Stripe is switched on, passes are sold through the old payment links.
  const admin = createAdminClient();
  if (!admin || !stripeReady()) {
    if (asked.payLink) redirect(asked.payLink);
    notFound();
  }
  const { data: tiers } = await admin
    .from("membership_tiers")
    .select("key, price, currency, active")
    .in("key", passes.map((p) => p.key));
  const onSale = passes
    .map((p) => ({ p, t: tiers?.find((t) => t.key === p.key) }))
    .filter(({ t }) => t?.active && Number(t.price) > 0)
    .map(({ p, t }) => ({
      key: p.key,
      name: p.name,
      price: t!.currency === "USD" ? `$${Number(t!.price).toLocaleString("en-US")}` : money(Number(t!.price), "CRC"),
      note: p.key === "week" ? "seven days in a row" : "one day, 8am to 8pm",
    }));
  if (!onSale.length) notFound();

  return (
    <div className="mship">
      <ArkFonts />
      <header className="ms-nav">
        <Link href="/ark-membership" aria-label="The ARK">
          <img src="/brand/ark-lockup-dark.png" alt="The ARK" height={34} />
        </Link>
        <nav>
          <Link href="/ark-membership">Membership</Link>
        </nav>
      </header>
      <main className="ms-apply">
        <Link href="/ark-membership" className="ms-back">
          ← Back to ARK membership
        </Link>
        <h1>Spend a day with us</h1>
        <p className="ms-prose">
          Cowork, the spa deck, the jungle gym and the day’s classes, 8am to 8pm. No application needed. Pay, and your
          pass arrives by email. It starts the first time you check in at the gate, any day in the next three months.
        </p>
        <PassForm plans={onSale} initial={onSale.some((p) => p.key === asked.key) ? asked.key : onSale[0].key} />
      </main>
    </div>
  );
}
