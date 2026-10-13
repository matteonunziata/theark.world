import type { Metadata } from "next";
import { PressForm } from "../site/forms";
import { SectionHead, SiteHero, SiteShell } from "../site/site-shell";

export const metadata: Metadata = {
  title: { absolute: "Press & media — The ARK, Santa Teresa" },
  description:
    "Stories, features and coverage about The ARK and what we're building in Santa Teresa, Costa Rica. Journalists, podcasters and filmmakers are welcome to get in touch.",
};

const COVERAGE = "https://elink.io/embed/9640c1f?initialWidth=1152";

export default function PressPage() {
  return (
    <SiteShell here="/press-media">
      <SiteHero
        eyebrow="The ARK in the world"
        title="Press & Media"
        sub="Stories, features, and coverage about The ARK and what we're building in Santa Teresa."
      />
      <section className="sec">
        <div className="wrap">
          <div className="embed tall">
            <iframe src={COVERAGE} title="Press and media coverage" loading="lazy" />
          </div>
        </div>
      </section>
      <section className="host sec white">
        <div className="wrap">
          <div className="host-copy">
            <h2>The ARK is a story worth telling.</h2>
            <p>
              If you&apos;re a journalist, podcaster, or documentary filmmaker exploring regenerative living, the future of
              community, or what it means to build a life by design — we&apos;re open to conversations.
            </p>
          </div>
          <PressForm />
        </div>
      </section>
    </SiteShell>
  );
}
