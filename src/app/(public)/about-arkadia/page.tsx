import type { Metadata } from "next";
import { Finite } from "../site/finite";
import { SectionHead, SiteHero, SiteShell } from "../site/site-shell";

// Served at /arkadia for anyone who isn't signed in (see src/lib/supabase/proxy.ts). /arkadia is the staff school area.
export const metadata: Metadata = {
  title: { absolute: "Arkadia, a space for conscious learning — The ARK, Santa Teresa" },
  description:
    "Arkadia is a living learning community where children explore freely between indoor and outdoor spaces, guided by curiosity, real experiences and meaningful relationships.",
  alternates: { canonical: "/arkadia" },
};

const APPLY = "https://arkadia.education/";
const WHATSAPP = "https://chat.whatsapp.com/FxEKA4we7GkEQ3RKr1W6En";
const IMG = "/site/about-arkadia";

const PILLARS = [
  ["Self-Directed Learning", "Children choose their activities, follow their interests, and learn by doing — building concentration, independence, and intrinsic motivation.", "self-directed-learning-09774e"],
  ["Real-World Learning", "Learning extends beyond materials and walls. Children participate in hands-on projects, explore the community, work with tools, and care for the land.", "real-world-learning-projects-064686"],
  ["Holistic Development", "Education at Arkadia cares for the mind, body, and heart. Children develop emotional intelligence, social awareness, and a healthy sense of self.", "holistic-development-094121"],
  ["Guided by Nature", "Our space is not only close to nature — it is of nature. Children learn outdoors, observe the living world, explore trails, and care for plants and animals.", "guided-by-nature-8fe85f"],
] as const;

const OFFERS = [
  "A prepared and relaxed learning environment",
  "A multicultural community",
  "Respect for biological and emotional rhythms",
  "Real-life learning experiences",
  "Personalized educational accompaniment",
  "A culture of empathy, respect, and love",
] as const;

export default function AboutArkadiaPage() {
  return (
    <SiteShell here="/arkadia">
      <SiteHero
        eyebrow="Arkadia"
        title="Space for conscious learning"
        sub="Arkadia is more than a school — it's a living learning community where children explore freely between indoor and outdoor spaces, guided by curiosity, real experiences and meaningful relationships. Rooted in joy, autonomy and authenticity, we offer a safe, trusting environment where they grow as whole human beings while staying true to who they are."
        image={`${IMG}/0c0bd297.webp`}
      >
        <a className="btn btn-accent" href={APPLY} target="_blank" rel="noreferrer">Apply</a>
        <a className="btn btn-ghost-light" href={WHATSAPP} target="_blank" rel="noreferrer">Join WhatsApp group</a>
      </SiteHero>

      <section className="sec">
        <div className="wrap">
          <SectionHead title="The Heart of Arkadia">
            Education at Arkadia unfolds through four interconnected pillars. Each pillar represents a fundamental aspect of
            how human beings learn and thrive:
          </SectionHead>
          <div className="pcards four">
            {PILLARS.map(([title, text, img]) => (
              <article key={title} className="pcard">
                <div className="ph">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${IMG}/${img}.webp`} alt={title} loading="lazy" />
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="sec split panel">
        <div className="wrap">
          <div className="split-copy">
            <h2>Why Arkadia?</h2>
            <p>Childhood is sacred.</p>
            <p>Learning should feel meaningful.</p>
            <p>Every child has a natural drive to grow — when given the right conditions.</p>
            <div className="btn-row">
              <a className="btn btn-primary" href={APPLY} target="_blank" rel="noreferrer">Apply now</a>
              <a className="btn btn-ghost" href={WHATSAPP} target="_blank" rel="noreferrer">Join WhatsApp group</a>
            </div>
          </div>
          <div className="card" style={{ flex: "999 1 420px", padding: 32 }}>
            <h3>Arkadia offers:</h3>
            <ul className="checks">
              {OFFERS.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <Finite />
    </SiteShell>
  );
}
