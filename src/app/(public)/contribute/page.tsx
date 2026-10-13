import type { Metadata } from "next";
import { ContributeForm } from "../site/forms";
import { SiteHero, SiteShell } from "../site/site-shell";

export const metadata: Metadata = {
  title: { absolute: "Contribute to The ARK — Santa Teresa" },
  description:
    "Host a retreat, share your craft or create content at The ARK in Santa Teresa, Costa Rica. Tell us what you have in mind and our team will be in touch.",
};

export default function ContributePage() {
  return (
    <SiteShell here="/contribute">
      <SiteHero
        eyebrow="The ARK · Santa Teresa"
        title="Contribute to The ARK"
        sub="Whether you want to host a retreat, share your craft, or create content, we'd love to hear from you. Fill out the form below and our team will be in touch."
      />
      <section className="host sec">
        <div className="wrap">
          <ContributeForm />
        </div>
      </section>
    </SiteShell>
  );
}
