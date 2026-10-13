import type { Metadata } from "next";
import { BROCHURE, SiteHero, SiteShell } from "../site/site-shell";

export const metadata: Metadata = {
  title: { absolute: "The ARK stewardship brochure — The ARK, Santa Teresa" },
  description:
    "A comprehensive overview of titled lots, fractional ownership, regenerative village architecture, community amenities and stewardship values at The ARK.",
};

export default function BecomeAStewardPage() {
  return (
    <SiteShell here="/become-a-steward" brochure={false}>
      <SiteHero
        eyebrow="Welcome to The ARK"
        title="The ARK Stewardship Brochure"
        sub="Comprehensive overview covering titled lots, fractional ownership, regenerative village architecture, community amenities, and stewardship values."
      >
        <a className="btn btn-accent" href={BROCHURE} download>Download brochure (PDF)</a>
        <a className="btn btn-ghost-light" href={BROCHURE} target="_blank" rel="noreferrer">Open in new tab →</a>
      </SiteHero>
      <section className="sec">
        <div className="wrap">
          <div className="embed tall" style={{ height: 820 }}>
            <iframe src={`${BROCHURE}#toolbar=1&navpanes=0`} title="Document preview" loading="lazy" />
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
