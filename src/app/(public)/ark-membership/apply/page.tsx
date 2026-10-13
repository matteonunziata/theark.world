/* eslint-disable @next/next/no-img-element -- the logo is a static file */
import type { Metadata } from "next";
import Link from "next/link";
import { ArkFonts } from "@/components/ark-fonts";
import { PLANS } from "../plans";
import { ApplyForm } from "./apply-form";
import { SiteNavBar } from "../../site/site-nav";
import "../membership.css";

export const metadata: Metadata = {
  title: { absolute: "Apply for membership — The ARK, Santa Teresa" },
  description:
    "The ARK is a curated community in Santa Teresa, Costa Rica. Memberships of a month or longer begin with an application.",
};

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v.slice(0, 120) : "");

export default async function ApplyPage({ searchParams }: PageProps<"/ark-membership/apply">) {
  const sp = await searchParams;
  const asked = one(sp.plan);
  const plan = PLANS.some((p) => p.key === asked && p.kind === "membership") ? asked : "";

  return (
    <div className="mship">
      <ArkFonts />
      <SiteNavBar here="/ark-membership" />

      <main className="ms-apply">
        <Link href="/ark-membership" className="ms-back">
          ← Back to ARK membership
        </Link>
        <h1>ARK membership application</h1>
        <p className="ms-prose">
          We cultivate a conscious, vibrant collective of creators, stewards, and visionaries in Santa
          Teresa. This application helps us get to know you, so take your time.
        </p>
        <ApplyForm
          plan={plan}
          utm={{
            utm_source: one(sp.utm_source) || one(sp.ref),
            utm_medium: one(sp.utm_medium),
            utm_campaign: one(sp.utm_campaign),
          }}
        />
      </main>
    </div>
  );
}
