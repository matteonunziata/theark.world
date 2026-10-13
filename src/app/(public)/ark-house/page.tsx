import Link from "next/link";
import type { Metadata } from "next";
import { SiteHero, SiteShell } from "../site/site-shell";

export const metadata: Metadata = {
  title: { absolute: "The ARK House — The ARK, Santa Teresa" },
  description:
    "A co-creation lounge designed for connection, focus and regeneration: spaces for deep work, collaborative gatherings and quiet contemplation at The ARK.",
};

const PHOTOS = [
  ["27e39577", "The ARK House Inspiration 1"],
  ["64b1aade", "The ARK House Inspiration 2"],
  ["bfcd225c", "The ARK House Inspiration 3"],
  ["b43ca986", "The ARK House Inspiration 4"],
] as const;

export default function ArkHousePage() {
  return (
    <SiteShell here="/ark-house">
      <SiteHero
        eyebrow="The ARK · Santa Teresa"
        title="The ARK House"
        sub="A co-creation lounge designed for connection, focus, and regeneration."
        image="/site/ark-house/ff358a5c.webp"
      >
        <Link className="btn btn-accent" href="/ark-membership">Join the ARK membership</Link>
      </SiteHero>
      <section className="sec split">
        <div className="wrap">
          <div className="split-copy">
            <h2>The Vision</h2>
            <p>
              The ARK House is more than a workspace. It&apos;s a sanctuary for creators, entrepreneurs, and visionaries to
              come together in an environment that nurtures both productivity and well-being. Nestled within nature, it
              offers spaces for deep work, collaborative gatherings, and quiet contemplation.
            </p>
          </div>
        </div>
      </section>
      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="gallery">
            {PHOTOS.map(([f, alt]) => (
              <div key={f} className="g">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/site/ark-house/${f}.webp`} alt={alt} loading="lazy" />
              </div>
            ))}
          </div>
          <p className="note">* The images shown on this page are conceptual inspirations and do not represent the final built designs.</p>
        </div>
      </section>
    </SiteShell>
  );
}
