import type { Metadata } from "next";
import { Finite } from "../site/finite";
import { SiteHero, SiteShell } from "../site/site-shell";

export const metadata: Metadata = {
  title: { absolute: "Our philosophy — The ARK, Santa Teresa" },
  description:
    "Health, equality, autonomy, regeneration and togetherness: the five principles behind everything built at The ARK in Santa Teresa, Costa Rica.",
};

const HEART = [
  ["H", "Health", "Health is embedded into daily life"],
  ["E", "Equality", "No race, nationality or worldview above another"],
  ["A", "Autonomy", "No one obliged to participate in any specific way"],
  ["R", "Regeneration", "The ARK is designed to restore"],
  ["T", "Togetherness", "Community is not an add-on"],
] as const;

export default function PhilosophyPage() {
  return (
    <SiteShell here="/philosophy">
      <SiteHero eyebrow="Our philosophy" title="Everything we do, we do from the" />
      <section className="sec">
        <div className="wrap">
          <div className="letters">
            {HEART.map(([n, word, line]) => (
              <div key={n} className="letter">
                <span className="n">{n}</span>
                <div>
                  <strong>{word}</strong>
                  <span>{line}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="sec split panel">
        <div className="wrap">
          <div className="split-copy">
            <h2>&ldquo;These aren&apos;t values on a wall. They are the design brief for everything we build.&rdquo;</h2>
            <p>— Marat, founder of The ARK</p>
          </div>
          <div className="split-media portrait-media">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/site/philosophy/baddd747.webp" alt="Marat, founder of The ARK" loading="lazy" />
          </div>
        </div>
      </section>
      <Finite />
    </SiteShell>
  );
}
