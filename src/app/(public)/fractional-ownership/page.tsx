import Link from "next/link";
import type { Metadata } from "next";
import { IncomeCalculator } from "../site/income-calculator";
import { Faq, SectionHead, SiteHero, SiteShell } from "../site/site-shell";
import { FEE_FAQ } from "./fee-faq";

export const metadata: Metadata = {
  title: { absolute: "Fractional ownership — The ARK, Santa Teresa" },
  description:
    "Own a share of a fully finished private villa on a 5,000 m² estate within The ARK in Santa Teresa, Costa Rica. Four weeks a year per share, managed for you, resellable at any time.",
};

const IMG = "/site/fractional-ownership";

const BENEFITS = [
  ["Immediate ROI", "You earn a return from the property from the first year of operations — without building, managing, or maintaining anything yourself."],
  ["Profit sharing from all ARK businesses", "As a shareholder you participate in the village-wide profit share — from events and hospitality to the farm and real estate sales."],
  ["Fully managed", "The ARK team handles everything — rental management, guest relations, maintenance, and property care — at 20% commission."],
  ["Resellable at any time", "Shares can be resold at any time based on the current market value of the property."],
] as const;

const FACTS = [
  ["Property type", "Fully furnished private villa"],
  ["Lot size", "5,000 m²"],
  ["Homes on lot", "8 individual villas"],
  ["Weeks per share / year", "4 weeks"],
  ["Full home option", "$275,000 · 12 shares"],
] as const;

const VILLA = [
  ["main-facade-de7b85", "Main facade", "Stone & timber · Tropical gardens"],
  ["private-terrace-475726", "Private terrace", "Teak deck · Jungle views"],
  ["living-room-46e0a9", "Living room", "Chukum walls · Natural light"],
  ["kitchen-83b51f", "Kitchen", "Custom woodwork · Natural light"],
  ["bathroom-3fa0d1", "Bathroom", "Travertine · Brass fixtures"],
  ["master-bedroom-517661", "Master bedroom", "Rattan & timber · Warm tones"],
  ["communal-pool-2f18a8", "Communal pool", "Shared estate amenity · Surrounded by gardens"],
] as const;

const COVERS = [
  "Property insurance and civil liability insurance",
  "Property taxes and annual corporate registration taxes",
  "Base electricity, water and internet consumption",
  "Maintenance services and amenities access",
  "Ordinary maintenance of units and common areas",
  "Weekly ordinary cleaning of units and common areas",
  "Repair or replacement of furnishings and utensils",
  "ARK Membership for owner + spouse",
] as const;

const PROGRESS = [
  ["Architecture", "Complete", false],
  ["Engineering", "In progress", true],
  ["Construction", "Begins Fall 2026", false],
  ["Move-in", "Q3 2027", false],
] as const;

export default function FractionalPage() {
  return (
    <SiteShell here="/fractional-ownership">
      <SiteHero
        eyebrow="Fractional ownership"
        title="The Lowest Entry — Into The ARK."
        sub={<span className="hero-tag">Only 23 shares remaining · 1 full home available · 11 individual shares from $24,900</span>}
        image={`${IMG}/dfadd46d.webp`}
      >
        <Link className="btn btn-accent" href="/apply-stewardship">Become a steward</Link>
        <a className="btn btn-ghost-light" href="#fractional-video">Learn more</a>
      </SiteHero>

      <section className="sec split">
        <div className="wrap">
          <div className="split-copy">
            <p className="eyebrow">The layout</p>
            <h2>Eight homes. One shared vision.</h2>
            <h3>Masterplan</h3>
            <p>
              Eight villas arranged across the site in four modules of two — positioned along the natural contours of the
              land to maximize privacy and preserve the existing jungle canopy.
            </p>
          </div>
          <div className="split-media">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${IMG}/masterplan-29de4d.webp`} alt="Masterplan" loading="lazy" />
          </div>
        </div>
      </section>

      <section className="sec panel">
        <div className="wrap">
          <SectionHead eyebrow="What is fractional ownership" title="Become a Seasonal Steward.">
            Fractional ownership lets you own a share of a fully finished private villa on a 5,000m² estate within The ARK.
            Eight individual homes sit on the lot — each beautifully designed and built to the ARK&apos;s architectural
            standards. You own your share. You enjoy your weeks. If you choose to, the property earns for you.
          </SectionHead>
          <div className="cards">
            {BENEFITS.map(([t, d]) => (
              <div key={t} className="card">
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
          <div className="cards two">
            <div className="card">
              <span className="eyebrow">Price per share</span>
              <span className="price">$24,900</span>
              <p>Includes 4 weeks per year</p>
            </div>
            <div className="card feature">
              <span className="eyebrow" style={{ color: "var(--accent-text)" }}>Full home · 12 shares</span>
              <span className="price">$275,000</span>
              <p>52 weeks per year · Entire villa yours</p>
            </div>
          </div>
          <div className="card" style={{ padding: 32 }}>
            <dl className="facts specs-list">
              {FACTS.map(([k, v]) => (
                <div key={k} style={{ display: "contents" }}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <div className="btn-row" style={{ marginTop: 20 }}>
              <Link className="btn btn-primary" href="/apply-stewardship">Become a steward →</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          <SectionHead eyebrow="Inside the villas" title="Built to the highest standard. Designed for the tropics.">
            The fractional estate villas were designed specifically for Santa Teresa&apos;s climate — natural ventilation,
            stone and timber finishes, and seamless indoor-outdoor living. Every detail reflects The ARK&apos;s commitment to
            craft and regenerative design.
          </SectionHead>
          <div className="pcards">
            {VILLA.map(([img, name, line]) => (
              <article key={img} className="pcard">
                <div className="ph">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${IMG}/${img}.webp`} alt={name} loading="lazy" />
                </div>
                <h3>{name}</h3>
                <span className="specs">{line}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="fractional-video" className="sec panel">
        <div className="wrap">
          <SectionHead eyebrow="Explaining fractional ownership" title="The ARK Founder, Marat Omarov" />
          <div className="embed" style={{ maxWidth: 960 }}>
            <iframe
              src="https://www.youtube-nocookie.com/embed/nYjKftjxRfM?start=2139&rel=0&modestbranding=1"
              title="Marat Omarov explains fractional ownership"
              loading="lazy"
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <p className="note">
            * Note: This recording references a share price of $22,000, which reflected Stage 1 early-access pricing.
            Current pricing is $24,900 per share and $275,000 for 12 shares.
          </p>
        </div>
      </section>

      <section className="sec split">
        <div className="wrap">
          <div className="split-copy">
            <p className="eyebrow">Rental income potential</p>
            <h2>Your weeks. Your choice.</h2>
            <p>When you&apos;re not here, your home earns.</p>
            <p className="note">
              Estimated figures based on 70% average occupancy and published nightly rates. Subject to season, amenities, and
              availability.
            </p>
          </div>
          <div className="card" style={{ flex: "999 1 480px", padding: 32 }}>
            <IncomeCalculator
              rates={[150, 175, 200, 225, 250]}
              initial={175}
              maintenance={{ label: "Annual maintenance fee ($600/share)", amount: 7200 }}
              price={{ amount: 275000, note: "ROI calculated based on annual rental of full house (12 shares) purchased at $275k" }}
            />
          </div>
        </div>
      </section>

      <section className="sec white">
        <div className="wrap">
          <SectionHead eyebrow="Annual fees" title="One simple fee. Everything covered.">
            A single annual contribution keeps your home in immaculate condition and the estate running smoothly. No surprise
            bills. No hidden costs. We handle the rest.
          </SectionHead>
          <div className="cards two">
            <div className="card" style={{ padding: 32 }}>
              <h3>What your contribution covers</h3>
              <ul className="checks">
                {COVERS.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div className="card">
                <span className="eyebrow">Per share · per year</span>
                <span className="price">$600</span>
                <p>A contribution toward operating costs</p>
              </div>
              <div className="card">
                <span className="eyebrow">Full home · 12 shares</span>
                <span className="price">$7,200</span>
                <p>Entire villa, 52 weeks per year</p>
              </div>
            </div>
          </div>
          <p className="note">The annual fee is a contribution toward operating costs.</p>
          <Faq items={FEE_FAQ} name="fees" />
        </div>
      </section>

      <section className="sec split">
        <div className="wrap">
          <div className="split-copy">
            <p className="eyebrow">Project progress</p>
            <h2>Where things stand today.</h2>
            <p>
              The fractional estate is actively moving through its development milestones. Architecture is complete.
              Engineering is underway. Construction is projected to begin in Fall 2026. Move-in targeted for Q3 2027.
            </p>
            <ol className="timeline">
              {PROGRESS.map(([name, when, now]) => (
                <li key={name} className={now ? "now" : undefined}>
                  <b>{name}</b>
                  <span>{when}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="split-media">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${IMG}/technical-architectural-plans-835534.webp`} alt="Technical Architectural Plans" loading="lazy" />
          </div>
        </div>
      </section>

      <section className="band-section">
        <div className="wrap members-band dark">
          <div>
            <p className="eyebrow">Reserve your shares</p>
            <h3>Only 23 shares remaining. Secure your villa</h3>
            <p>
              This is the ideal entry point for anyone who wants to experience life at The ARK before committing to full
              residency — or for those who want a passive income asset with genuine lifestyle benefits.
            </p>
            <p>Finite supply. Infinite Happiness.</p>
          </div>
          <div className="btn-row">
            <Link className="btn btn-accent" href="/apply-stewardship">Become a steward</Link>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
