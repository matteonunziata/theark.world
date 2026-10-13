import Link from "next/link";
import type { Metadata } from "next";
import { loadPublicLots, titledLotsLeft } from "@/lib/public-lots";
import { Finite } from "../site/finite";
import { BROCHURE, Faq, SectionHead, SiteHero, SiteShell } from "../site/site-shell";
import { HOME_FAQ } from "./home-faq";

export const metadata: Metadata = {
  title: { absolute: "The ARK — A regenerative village in Santa Teresa, Costa Rica" },
  description:
    "The ARK is a prototype for the future of human settlement: a village where people, nature and enterprise form one regenerative living system, in Santa Teresa on Costa Rica's Nicoya Peninsula.",
};

const IMG = "/site/home";

const DAILY = [
  ["Movement classes", "movement-classes-42e4cb"],
  ["Padel & Pickleball", "padel-pickleball-85c7d9"],
  ["Work & Create", "work-create-05d2f6"],
  ["Evening Concerts", "evening-concerts-484d57"],
  ["Farm to table dinners", "farm-to-table-dinners-7766f0"],
  ["Community Life", "community-life-404702"],
  ["Togetherness", "togetherness-d61b12"],
] as const;

const HOMES_NOW = ["the-ark-home-1-07a5e3", "the-ark-home-2-5fbc3f", "the-ark-home-3-f3f94f", "the-ark-home-4-7cb3e6", "the-ark-home-5-dab6fa"] as const;

const FARM_PHOTOS = [
  ["ark-farm-shop-shelves-stocked-wi-5292f4", "ARK Farm Shop shelves stocked with farm-made jars"],
  ["the-ark-super-greens-jar-with-fr-f531cd", "The ARK Super Greens jar with fresh spinach and moringa"],
  ["freshly-harvested-cucumbers-from-7bb095", "Freshly harvested cucumbers from the ARK Farm"],
  ["fresh-spinach-from-the-ark-farm-f5fac5", "Fresh spinach from the ARK Farm"],
  ["fresh-farm-eggs-turmeric-and-her-635803", "Fresh farm eggs, turmeric, and herbs from the ARK Farm"],
  ["free-range-chicken-at-the-ark-fa-5f9e5d", "Free-range chicken at The ARK Farm"],
] as const;

const FARM_POINTS = [
  ["Regenerative agriculture", "Restoring soil health and increasing local biodiversity through sustainable practices."],
  ["Farm shop", "Fresh, organic produce delivered directly to the community kitchen and residents."],
  ["Hands-on education", "Workshops and learning opportunities for both children and adults."],
] as const;

const ARKADIA_POINTS = [
  ["Curiosity-led learning", "Child-directed exploration guided by natural rhythms and real-world experience."],
  ["Fluid indoor/outdoor environments", "No walls between the classroom and the living world around it."],
  ["A community of children, not a classroom", "Multi-age learning with meaningful relationships at the centre."],
] as const;

const HOUSE_POINTS = [
  ["Deep work spaces", "Quiet areas designed for focus and uninterrupted productivity."],
  ["Collaborative lounges", "Open environments for connection, brainstorming, and shared creation."],
  ["Flexible memberships", "Passes ranging from day access to annual dedicated memberships."],
] as const;

const PARTNERS = [
  ["nicoya-peninsula-foundation-f3052f", "Nicoya Peninsula Foundation"],
  ["karen-mogensen-reserve-6c8aca", "Karen Mogensen Reserve"],
  ["futuro-nativo-9e7d47", "Futuro Nativo"],
] as const;

const COUNTRIES =
  "Argentina · Austria · Australia · Belgium · Brazil · Canada · Chile · Colombia · Costa Rica · Czech Republic · France · Germany · India · Israel · Kazakhstan · Lichtenstein · The Netherlands · USA · Switzerland";

const k = (n: number) => (n >= 100000 ? `$${Math.round(n / 1000)}k` : `$${(n / 1000).toFixed(1)}k`);

export default async function HomePage() {
  const lots = await loadPublicLots();
  const left = titledLotsLeft(lots);
  const forSale = lots.filter((l) => l.status === "available" && l.price != null);
  const cheapest = (pick: (l: (typeof lots)[number]) => boolean, fallback: number) => {
    const prices = forSale.filter(pick).map((l) => Number(l.price));
    return prices.length ? Math.min(...prices) : fallback;
  };
  const homesFrom = cheapest((l) => l.kind !== "fractional" && !!l.name, 899000);
  const lotsFrom = cheapest((l) => l.kind === "lot" && !l.name, 375000);
  const sharesFrom = cheapest((l) => l.kind === "fractional", 24900);

  return (
    <SiteShell here="/home">
      <SiteHero
        eyebrow="Santa Teresa · Nicoya Peninsula · Costa Rica"
        title="More Than A Home - A Whole Life"
        sub="The ARK is a prototype for the future of human settlement. A village where people, nature, and enterprise form one regenerative living system."
        image={`${IMG}/hero-poster.jpg`}
        video={`${IMG}/hero.mp4`}
      >
        <Link className="btn btn-accent" href="/apply-stewardship">Become a steward</Link>
        <a className="btn btn-ghost-light" href={BROCHURE} download>Download brochure</a>
        <Link className="btn btn-ghost-light" href="/ark-membership">Join as a member</Link>
        <Link className="btn btn-ghost-light" href="/stay">Stay at The ARK</Link>
      </SiteHero>

      <section className="sec">
        <div className="wrap">
          <p className="hero-tag" style={{ color: "var(--eyebrow)" }}>Limited opportunity - only {left} titled lots left</p>
          <div className="cards four">
            {["Full-service living", "Onsite education for kids", "Regenerative organic farm", "5 min to the beach"].map((t) => (
              <div key={t} className="card"><h3 style={{ fontSize: 20 }}>{t}</h3></div>
            ))}
          </div>
        </div>
      </section>

      <section className="sec panel">
        <div className="wrap">
          <SectionHead eyebrow="Daily life at The ARK" title="Ordinary Days — Made Extraordinary">
            Life at The ARK is rich and full by design. Every day brings movement, connection, creativity, and nourishment
            — not as scheduled activities but as the natural rhythm of a community that has built its life this way on
            purpose.
          </SectionHead>
          <div className="pcards four daily">
            {DAILY.map(([name, img]) => (
              <article key={name} className="pcard">
                <div className="ph">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${IMG}/${img}.webp`} alt={name} loading="lazy" />
                </div>
                <h3>{name}</h3>
              </article>
            ))}
          </div>
          <p className="note">If you found your way here, you belong - stewards from all over the world</p>
          <p className="note">{COUNTRIES}</p>
          <div className="btn-row">
            <Link className="btn btn-primary" href="/whats-on">View upcoming events</Link>
            <Link className="btn btn-ghost" href="/stay">Plan a visit</Link>
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          <SectionHead eyebrow="Stewardship" title="Ways to be a steward of The ARK">
            Whether you want to build your vision from the ground up, move into a finished home, or be a part-time steward —
            there is a path into The ARK.
          </SectionHead>
          <div className="cards">
            <div className="card">
              <h3>Homes For Re-Sale</h3>
              <span className="price">from {k(homesFrom)}</span>
              <p>⌂ Move-in-ready villas with full community membership. Enjoy access to all shared spaces and the daily rhythm of life at The ARK.</p>
              <ul className="checks">
                <li>Casa Lilith — 232 m² · 3 bed · 2 bath · Pool · Solar</li>
                <li>Casa Trinidad — 500 m² · 5 bed · 5 bath · Ocean &amp; jungle views</li>
                <li>Tanit Estate — 700 m² · 7 bed · 6 bath · Pacific Ocean views</li>
              </ul>
              <Link className="btn btn-primary" href="/homes-for-sale">View all homes</Link>
            </div>
            <div className="card">
              <h3>Titled Lots</h3>
              <span className="price">from {k(lotsFrom)}</span>
              <p>⚑ Only {left} lots remaining in stage 3 — price increases next stage</p>
              <ul className="checks">
                <li>Full freehold title in your name</li>
                <li>Build your home to your design</li>
                <li>Profit share rights</li>
                <li>Discount on membership &amp; amenities</li>
                <li>Rental managed by The ARK</li>
              </ul>
              <Link className="btn btn-primary" href="/titled-lot-ownership">Explore available lots</Link>
            </div>
            <div className="card">
              <h3>Fractional Ownership</h3>
              <span className="price">from {k(sharesFrom)}</span>
              <p>✦ Ideal for singles and part-time residency.</p>
              <ul className="checks">
                <li>4 weeks on property per year</li>
                <li>Fully furnished 2-bedroom Casita</li>
                <li>1 share = 4 weeks per year at The ARK</li>
                <li>Purchase of 12 shares = 1 full home</li>
                <li>Profit sharing rights</li>
                <li>Shares resellable</li>
                <li>Rental managed by The ARK</li>
              </ul>
              <Link className="btn btn-primary" href="/fractional-ownership">Learn about FO</Link>
            </div>
          </div>
          <div className="gallery">
            {HOMES_NOW.map((h, i) => (
              <div key={h} className="g">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${IMG}/${h}.webp`} alt={`The ARK Home ${i + 1}`} loading="lazy" />
              </div>
            ))}
          </div>
          <p className="note">* ARK resident home currently under construction</p>
          <div className="quotes">
            <figure className="quote">
              <span className="stars" aria-label="Five stars">★★★★★</span>
              <blockquote>
                &ldquo;Moving to The ARK feels like I found heaven on earth, I believe the demand for this life will far exceed
                the 100 families who can ever have it&rdquo;
              </blockquote>
              <figcaption>Sachin — USA · Entrepreneur · Full-time resident</figcaption>
            </figure>
          </div>
          <div className="btn-row">
            <Link className="btn btn-primary" href="/apply-stewardship">Become a steward</Link>
          </div>
        </div>
      </section>

      <section className="sec panel">
        <div className="wrap">
          <SectionHead eyebrow="The farm" title="Food grown steps from your kitchen">
            The ARK Farm is autonomy in practice. Our own food. Our own energy. It operates on the belief that nature has the
            power to regenerate itself when given the right care. Guided by principles of permaculture, agroforestry, and
            regenerative agriculture, we aim to restore depleted soil, increase biodiversity, and cultivate food that sustains
            both people and the planet.
          </SectionHead>
          <div className="cards">
            {FARM_POINTS.map(([t, d]) => (
              <div key={t} className="card">
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
          <div className="gallery">
            {FARM_PHOTOS.map(([img, alt]) => (
              <div key={img} className="g">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${IMG}/${img}.webp`} alt={alt} loading="lazy" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sec split">
        <div className="wrap">
          <div className="split-copy">
            <p className="eyebrow">For families</p>
            <h2>Arkadia school Center for Conscious Learning</h2>
            <p>Where life and learning align — families become part of a thriving environment and education reflects the life they&apos;ve chosen.</p>
            <p>
              Arkadia replaces traditional schooling with a more natural approach. Children learn through exploration,
              real-world experiences, and meaningful relationships — moving freely between indoor and outdoor environments.
            </p>
            <div className="btn-row">
              <Link className="btn btn-primary" href="/arkadia">Learn more</Link>
              <a className="btn btn-ghost" href="https://arkadia.education/" target="_blank" rel="noreferrer">Arkadia application</a>
            </div>
          </div>
          <div className="split-media portrait-media">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${IMG}/children-doing-art-at-arkadia-b1b3e7.webp`} alt="Children doing art at Arkadia" loading="lazy" />
          </div>
        </div>
        <div className="wrap" style={{ marginTop: 40 }}>
          <div className="cards" style={{ width: "100%" }}>
            {ARKADIA_POINTS.map(([t, d]) => (
              <div key={t} className="card">
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sec split flip panel">
        <div className="wrap">
          <div className="split-copy">
            <p className="eyebrow">For creators &amp; visionaries</p>
            <h2>The ARK House (Coworking Space)</h2>
            <p>
              A sanctuary for creators, entrepreneurs, and visionaries to come together in an environment that nurtures both
              productivity and well-being. Nestled within nature, it offers spaces for deep work, collaborative gatherings,
              and quiet contemplation.
            </p>
            <div className="btn-row">
              <Link className="btn btn-primary" href="/ark-house">Learn more</Link>
              <Link className="btn btn-ghost" href="/ark-membership">The ARK membership</Link>
            </div>
          </div>
          <div className="split-media">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${IMG}/the-ark-house-inspiration-0bb0e1.webp`} alt="The ARK House Inspiration" loading="lazy" />
          </div>
        </div>
        <div className="wrap" style={{ marginTop: 40 }}>
          <div className="cards" style={{ width: "100%" }}>
            {HOUSE_POINTS.map(([t, d]) => (
              <div key={t} className="card">
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          <SectionHead eyebrow="The land" title="From overgrazed pasture to living ecosystem" />
          <div className="split-copy" style={{ maxWidth: 760 }}>
            <p>
              This land has a story. For decades it was used for cattle grazing — until it was depleted, left with barely 15
              plant species and little productive soil remaining.
            </p>
            <p>
              Marat discovered it by chance in 2021, over breakfast in Santa Teresa. He saw past what it was to what it could
              become. By 2022 The ARK was born.
            </p>
            <p>
              The early years were hard. No sales, no outside funding — just conviction. That period became the foundation.
              The team built the permaculture farm from scratch. Today the land supports over 400 plant species and a growing
              community.
            </p>
            <p>
              One decision defines what The ARK stands for more than any other: Joaquín Sánchez&apos;s family — stewards of
              this land since 1966 — were offered 25% of all proceeds from The ARK&apos;s businesses. Not as a transaction. As a
              recognition that this land has a history worth honoring.
            </p>
            <p>
              87 residential lots, each a minimum of 5,000m². Fewer lots by design, so more land stays wild, restored, and
              regenerating.
            </p>
          </div>
          <div className="gallery">
            {(
              [
                ["the-story-of-our-land-top-df07bb", "The Story of Our Land - Top"],
                ["the-story-of-our-land-bottom-f66657", "The Story of Our Land - Bottom"],
              ] as const
            ).map(([img, alt]) => (
              <div key={img} className="g">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${IMG}/${img}.webp`} alt={alt} loading="lazy" />
              </div>
            ))}
          </div>
          <h3>Supporting our local community</h3>
          <p className="lede">
            The ARK is committed to working with and supporting local organizations dedicated to conservation, community
            development, and preserving the natural heritage of the Nicoya Peninsula.
          </p>
          <div className="partners">
            {PARTNERS.map(([img, name]) => (
              <div key={img} className="partner">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${IMG}/${img}.webp`} alt={name} loading="lazy" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sec panel">
        <div className="wrap">
          <SectionHead eyebrow="Before you ask" title="The questions everyone asks first" />
          <Faq items={HOME_FAQ} name="home" />
        </div>
      </section>

      <Finite review />
    </SiteShell>
  );
}
