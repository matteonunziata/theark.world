import Link from "next/link";
import type { Metadata } from "next";
import { loadPublicLots, titledLotsLeft } from "@/lib/public-lots";
import { BrochureForm } from "../site/forms";
import { BROCHURE, Faq, SectionHead, SiteHero, SiteShell } from "../site/site-shell";
import { HOME_FAQ } from "./home-faq";
import "./home.css";

export const metadata: Metadata = {
  title: { absolute: "The ARK — A regenerative village in Santa Teresa, Costa Rica" },
  description:
    "The ARK is a prototype for the future of human settlement: a village where people, nature and enterprise form one regenerative living system, in Santa Teresa on Costa Rica's Nicoya Peninsula.",
};

const IMG = "/site/home";

const FACTS = ["Full-service living", "Onsite education for kids", "Regenerative organic farm", "5 min to the beach"] as const;

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

const VILLAGE = [
  {
    n: "01 · The Farm",
    title: "Food grown steps from your kitchen",
    text: "Autonomy in practice: our own food, our own energy. Guided by permaculture, agroforestry and regenerative agriculture, the farm restores depleted soil, grows biodiversity and feeds the community.",
    img: "ark-farm-shop-shelves-stocked-wi-5292f4",
    alt: "ARK Farm Shop shelves stocked with farm-made jars",
    points: [
      ["Regenerative agriculture", "healthier soil, more life."],
      ["Farm shop", "fresh organic produce for residents and the community kitchen."],
      ["Hands-on education", "workshops for children and adults."],
    ],
    links: [["Visit the farm shop →", "/farm-shop"]],
  },
  {
    n: "02 · For families",
    title: "Arkadia, a centre for conscious learning",
    text: "Where life and learning align. Children learn through exploration, real-world experience and meaningful relationships, moving freely between indoor and outdoor spaces.",
    img: "children-doing-art-at-arkadia-b1b3e7",
    alt: "Children doing art at Arkadia",
    points: [
      ["Curiosity-led learning", "guided by natural rhythms."],
      ["No walls", "between the classroom and the living world."],
      ["A community of children", "multi-age, with relationships at the centre."],
    ],
    links: [
      ["Learn about Arkadia →", "/arkadia"],
      ["Apply →", "https://arkadia.education/"],
    ],
    flip: true,
  },
  {
    n: "03 · For creators & visionaries",
    title: "The ARK House: work, nestled in nature",
    text: "A sanctuary for creators, entrepreneurs and visionaries, with space for deep work, collaborative gatherings and quiet contemplation.",
    img: "the-ark-house-inspiration-0bb0e1",
    alt: "The ARK House",
    points: [
      ["Deep work spaces", "quiet, focused, uninterrupted."],
      ["Collaborative lounges", "for connection and shared creation."],
      ["Flexible memberships", "from a day pass to an annual dedicated desk."],
    ],
    links: [
      ["Explore the ARK House →", "/ark-house"],
      ["Membership →", "/ark-membership"],
    ],
  },
] as const;

const PARTNERS = [
  ["nicoya-peninsula-foundation-f3052f", "Nicoya Peninsula Foundation"],
  ["karen-mogensen-reserve-6c8aca", "Karen Mogensen Reserve"],
  ["futuro-nativo-9e7d47", "Futuro Nativo"],
] as const;

const COUNTRIES =
  "Argentina · Austria · Australia · Belgium · Brazil · Canada · Chile · Colombia · Costa Rica · Czech Republic · France · Germany · India · Israel · Kazakhstan · Lichtenstein · The Netherlands · USA · Switzerland";

const k = (n: number) => (n >= 100000 ? `$${Math.round(n / 1000)}k` : `$${(n / 1000).toFixed(1)}k`);

/** Internal paths go through next/link; full URLs open as plain links. */
function A({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  return href.startsWith("http") ? (
    <a className={className} href={href} target="_blank" rel="noreferrer">{children}</a>
  ) : (
    <Link className={className} href={href}>{children}</Link>
  );
}

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
    <SiteShell here="/home" brochure={false}>
      <SiteHero
        className="hm-hero"
        eyebrow="Santa Teresa · Nicoya Peninsula · Costa Rica"
        title={
          <>
            More than a home.
            <br />
            <em>A whole life.</em>
          </>
        }
        sub="The ARK is a prototype for the future of human settlement. A village where people, nature, and enterprise form one regenerative living system."
        image={`${IMG}/hero-poster.jpg`}
        video={`${IMG}/hero.mp4`}
      >
        <Link className="btn btn-accent" href="/apply-stewardship">Become a steward</Link>
        <a className="btn btn-ghost-light" href={BROCHURE} download>Download brochure</a>
      </SiteHero>

      <section className="sec dark hm-in">
        <div className="wrap">
          <div className="hm-facts">
            {FACTS.map((t) => (
              <p key={t}>{t}</p>
            ))}
          </div>
          <div>
            <p className="hm-label" style={{ marginBottom: 20 }}>Three ways in</p>
            <div className="hm-ways">
              <Link className="hm-way" href="/apply-stewardship">
                <span className="kicker">Live here</span>
                <h3>Become a steward</h3>
                <p>Own a home, a titled lot, or a fractional share. Only {left} titled lots left.</p>
                <span className="go">Explore ownership →</span>
              </Link>
              <Link className="hm-way" href="/ark-membership">
                <span className="kicker">Belong here</span>
                <h3>Join as a member</h3>
                <p>Cowork, train, eat and gather, without owning land.</p>
                <span className="go">See membership →</span>
              </Link>
              <Link className="hm-way" href="/stay">
                <span className="kicker">Try it first</span>
                <h3>Stay at The ARK</h3>
                <p>Book a guest stay or come to an event. Most residents visited first.</p>
                <span className="go">Plan a visit →</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="sec" id="life">
        <div className="wrap">
          <div className="hm-head">
            <SectionHead eyebrow="Daily life at The ARK" title={<>Ordinary days, <em>made extraordinary.</em></>}>
              Movement, connection, creativity and nourishment. Not scheduled activities, but the natural rhythm of a
              community that has built its life this way on purpose.
            </SectionHead>
          </div>
          <div className="hm-daily">
            {DAILY.map(([name, img]) => (
              <figure key={name}>
                <div className="ph">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${IMG}/${img}.webp`} alt={name} loading="lazy" />
                </div>
                <figcaption>{name}</figcaption>
              </figure>
            ))}
          </div>
          <div className="hm-belong">
            <h3>If you found your way here, you belong.</h3>
            <p>Stewards from {COUNTRIES}</p>
          </div>
          <div className="hm-actions">
            <Link className="btn btn-primary" href="/whats-on">View upcoming events</Link>
            <Link className="btn btn-ghost" href="/stay">Plan a visit</Link>
          </div>
        </div>
      </section>

      <section className="sec panel hm-village" id="village">
        <div className="wrap">
          <div className="hm-head">
            <SectionHead eyebrow="The village" title={<>Everything a good life needs, <em>within walking distance.</em></>} />
          </div>
          {VILLAGE.map((v) => (
            <article key={v.n} className={`hm-article${"flip" in v ? " flip" : ""}`}>
              {"flip" in v ? (
                <>
                  <Copy v={v} />
                  <Media v={v} />
                </>
              ) : (
                <>
                  <Media v={v} />
                  <Copy v={v} />
                </>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="sec dark hm-story" id="story">
        <div className="wrap">
          <div className="hm-story-head">
            <div>
              <p className="eyebrow">The land</p>
              <h2>From overgrazed pasture <em>to living ecosystem.</em></h2>
            </div>
            <div className="text">
              <p>
                For decades this land was grazed by cattle until it was depleted, left with barely 15 plant species.
                Marat discovered it by chance in 2021, over breakfast in Santa Teresa, and saw what it could become. By
                2022 The ARK was born.
              </p>
              <p>
                The early years were hard: no sales, no outside funding, just conviction. The team built the permaculture
                farm from scratch, and that period became the foundation.
              </p>
              <p>
                One decision defines us more than any other. Joaquín Sánchez&apos;s family, stewards of this land since
                1966, were offered 25% of all proceeds from The ARK&apos;s businesses. Not as a transaction, but in
                recognition of a history worth honouring.
              </p>
            </div>
          </div>
          <div className="hm-stats">
            <div><b>15 → 400+</b><span>plant species, then and now</span></div>
            <div><b>87</b><span>residential lots, min. 5,000 m². Fewer by design, so more land stays wild.</span></div>
            <div><b>25%</b><span>of business proceeds to the land&apos;s original stewards</span></div>
            <div><b>100</b><span>families will ever call The ARK home</span></div>
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
          <div className="hm-community">
            <p>
              We work alongside local organisations dedicated to conservation, community development and the natural
              heritage of the Nicoya Peninsula.
            </p>
            <div className="logos">
              {PARTNERS.map(([img, name]) => (
                <div key={img} className="partner">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${IMG}/${img}.webp`} alt={name} loading="lazy" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="sec hm-quote">
        <blockquote>
          <p>
            &ldquo;Moving to The ARK feels like I found heaven on earth. I believe the demand for this life will far
            exceed the 100 families who can ever have it.&rdquo;
          </p>
          <footer>Sachin — USA · Entrepreneur · Full-time resident</footer>
        </blockquote>
      </section>

      <section className="sec" id="own">
        <div className="wrap">
          <div className="hm-head">
            <SectionHead eyebrow="Stewardship" title={<>Find your path <em>into The ARK.</em></>}>
              Build from the ground up, move into a finished home, or join part-time. Every path includes full community
              membership.
            </SectionHead>
          </div>
          <div className="hm-plans">
            <div className="card">
              <span className="kicker">Part-time</span>
              <h3>Fractional Ownership</h3>
              <p><span className="from">from</span><span className="price">{k(sharesFrom)}</span></p>
              <p>Ideal for singles and part-time residency.</p>
              <ul className="checks">
                <li>1 share = 4 weeks per year at The ARK</li>
                <li>Fully furnished 2-bedroom casita</li>
                <li>12 shares = 1 full home</li>
                <li>Profit-sharing rights</li>
                <li>Shares resellable · rental managed by The ARK</li>
              </ul>
              <Link className="btn btn-ghost" href="/fractional-ownership">Learn about fractional</Link>
            </div>
            <div className="card feature">
              <span className="kicker">Build your vision · {left} left</span>
              <h3>Titled Lots</h3>
              <p><span className="from">from</span><span className="price">{k(lotsFrom)}</span></p>
              <p>Stage 3 pricing. Price increases next stage.</p>
              <ul className="checks">
                <li>Full freehold title in your name</li>
                <li>Build your home to your design</li>
                <li>Profit share rights</li>
                <li>Discount on membership &amp; amenities</li>
                <li>Rental managed by The ARK</li>
              </ul>
              <Link className="btn btn-accent" href="/titled-lot-ownership">Explore available lots</Link>
            </div>
            <div className="card">
              <span className="kicker">Move-in ready</span>
              <h3>Homes For Re-Sale</h3>
              <p><span className="from">from</span><span className="price">{k(homesFrom)}</span></p>
              <p>Finished villas with full community membership.</p>
              <ul className="checks">
                <li><span><strong>Casa Lilith</strong><small>232 m² · 3 bed · 2 bath · Pool · Solar</small></span></li>
                <li><span><strong>Casa Trinidad</strong><small>500 m² · 5 bed · 5 bath · Ocean &amp; jungle views</small></span></li>
                <li><span><strong>Tanit Estate</strong><small>700 m² · 7 bed · 6 bath · Pacific Ocean views</small></span></li>
              </ul>
              <Link className="btn btn-ghost" href="/homes-for-sale">View all homes</Link>
            </div>
          </div>
          <div className="hm-homes">
            {HOMES_NOW.map((h, i) => (
              <div key={h} className="g">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${IMG}/${h}.webp`} alt={`The ARK Home ${i + 1}`} loading="lazy" />
              </div>
            ))}
          </div>
          <p className="note">* ARK resident home currently under construction</p>
        </div>
      </section>

      <section className="sec hm-visit" id="visit">
        <div className="box">
          <div>
            <p className="eyebrow">Come see for yourself</p>
            <h2>Visit before you decide.</h2>
            <p>Book a guest stay, come to an event, or join a founder webinar. Many of our residents visited once, and stayed.</p>
          </div>
          <div className="btn-row">
            <Link className="btn btn-primary" href="/stay">Plan a visit</Link>
            <Link className="btn btn-ghost" href="/whats-on">Upcoming events</Link>
          </div>
        </div>
      </section>

      <section className="sec hm-faq" id="faq">
        <div className="wrap">
          <div className="head">
            <p className="eyebrow">Before you ask</p>
            <h2>The questions everyone asks first.</h2>
            <Link className="hm-link" href="/faq">See all FAQs →</Link>
          </div>
          <Faq items={HOME_FAQ} name="home" />
        </div>
      </section>

      <section className="sec dark hm-cta">
        <div className="wrap">
          <div className="lead">
            <p className="eyebrow">Stage 3 · {left} lots remaining</p>
            <h2>Finite opportunity. <em>Infinite happiness.</em></h2>
            <p>Only 100 families will ever call The ARK home. Will yours be one of them?</p>
            <Link className="btn btn-accent" href="/apply-stewardship">Become one of the 100</Link>
            <p className="note">Prices increase with the next stage</p>
            <blockquote>
              <p>
                &ldquo;We spent six months researching eco-communities across three continents. The ARK was the only one
                where the founder answered the phone and the residents vouched without prompting.&rdquo;
              </p>
              <footer>Sophie &amp; Kai — Netherlands · Family · 2 children</footer>
            </blockquote>
          </div>
          <div className="hm-brochure">
            <div className="plan">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/site/shared/master-plan.webp" alt="The ARK Master Plan" loading="lazy" />
            </div>
            <h3>Get the stewardship brochure</h3>
            <p>The vision, the land, the master plan, and every way to be part of The ARK.</p>
            <BrochureForm href={BROCHURE} />
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

type Item = (typeof VILLAGE)[number];

function Media({ v }: { v: Item }) {
  return (
    <div className="media">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${IMG}/${v.img}.webp`} alt={v.alt} loading="lazy" />
    </div>
  );
}

function Copy({ v }: { v: Item }) {
  return (
    <div className="copy">
      <p className="eyebrow">{v.n}</p>
      <h3>{v.title}</h3>
      <p>{v.text}</p>
      <ul className="hm-points">
        {v.points.map(([b, t]) => (
          <li key={b}>
            <strong>{b}</strong> <span>— {t}</span>
          </li>
        ))}
      </ul>
      <div className="hm-links">
        {v.links.map(([label, href]) => (
          <A key={label} className="hm-link" href={href}>{label}</A>
        ))}
      </div>
    </div>
  );
}
