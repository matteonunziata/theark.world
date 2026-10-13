import type { Metadata } from "next";
import { StewardshipForm } from "../site/forms";
import { SiteHero, SiteShell } from "../site/site-shell";

export const metadata: Metadata = {
  title: { absolute: "Apply to become a steward — The ARK, Santa Teresa" },
  description:
    "Becoming a steward of The ARK in Santa Teresa, Costa Rica begins with an application. It is the first step, and it takes two to three minutes.",
};

export default function ApplyStewardshipPage() {
  return (
    <SiteShell here="/apply-stewardship">
      <SiteHero
        eyebrow="The ARK · Santa Teresa"
        title="Stewardship"
        sub="Becoming a steward of The ARK begins with an application — this is the first step, and it takes 2-3 minutes."
      />
      <section className="host sec">
        <div className="wrap">
          <StewardshipForm />
        </div>
      </section>
    </SiteShell>
  );
}
