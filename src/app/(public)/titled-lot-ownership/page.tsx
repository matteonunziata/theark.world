import Link from "next/link";
import type { Metadata } from "next";
import { loadPublicLots, titledLotsLeft } from "@/lib/public-lots";
import { IncomeCalculator } from "../site/income-calculator";
import { SectionHead, SiteHero, SiteShell } from "../site/site-shell";

export const metadata: Metadata = {
  title: { absolute: "Titled lot ownership — The ARK, Santa Teresa" },
  description:
    "Own a titled lot of 5,000 m² or more at The ARK in Santa Teresa, Costa Rica, with full support to design and build, and a share in every business in the village.",
};

const IMG = "/site/titled-lot-ownership";

const STAGES = [
  ["Founding Members", "Sold out", "From $297k", "Yes", "100%"],
  ["Stage 1", "Sold out", "From $310k", "Yes", "100%"],
  ["Stage 2", "Sold out", "From $330k", "Yes", "80%"],
  ["Stage 3", "Next 8", "From $375k", "Yes", "70%"],
  ["Stage 4", "Next 12", "TBD", "Yes", "60%"],
  ["Stage 5", "Next 21", "TBD", "Yes", "50%"],
] as const;

const HOMES = [
  ["Casa La Sierra", "Available for rent", "2 bed · Jungle & ocean views", "casa-la-sierra-f4ef1f"],
  ["Single-storey retreat", "Under construction", "2 bed · Jungle & mountain views", "single-storey-retreat-40b93b"],
  ["Tanit Estate", "Available for sale", "700 sqm | 6 bathrooms | 7 bedrooms", "tanit-estate-622de4"],
  ["Two-storey family home", "Under construction", "3 bed · Mountain & ocean views", "two-storey-family-home-f0a964"],
] as const;

const INCLUDED = [
  "Lots from 5,000m²",
  "Build up to 25% of land",
  "Architectural guidelines",
  "Full construction support",
  "Water & solar infrastructure",
] as const;

const BUSINESSES = [
  ["Events", "Wellness · Culture & Art · Retreats"],
  ["Farm", "Organic produce · Farm shop"],
  ["Arkadia", "Education Tuition"],
  ["Hospitality", "Concierge · Rental program"],
  ["Food & Cafes", "Restaurants · Community kitchen"],
  ["Real Estate", "Lands · Houses · Fractional"],
] as const;

const SHARES = [
  ["31%", "Land stewards"],
  ["25%", "Original land owners"],
  ["10%", "Local community"],
  ["34%", "Team"],
] as const;

export default async function TitledLotPage() {
  const left = titledLotsLeft(await loadPublicLots());
  return (
    <SiteShell here="/titled-lot-ownership">
      <SiteHero eyebrow="Investment stages" title="You Dream It We Build It" image={`${IMG}/0015b5f0.webp`}>
        <Link className="btn btn-accent" href="/apply-stewardship">Become a steward</Link>
        <Link className="btn btn-ghost-light" href="/live-lot-prices">Lot prices</Link>
      </SiteHero>

      <section className="sec">
        <div className="wrap">
          <SectionHead eyebrow="An open window" title="Stage 3 Pricing">
            Lot prices increase with each stage as the village grows. Earlier stages carry greater profit share and deeper
            amenity discounts.
          </SectionHead>
          <div className="tbl">
            <table>
              <thead>
                <tr>
                  <th>Stage</th>
                  <th>Lots</th>
                  <th>Price</th>
                  <th>Profit share</th>
                  <th>ARK membership discount</th>
                </tr>
              </thead>
              <tbody>
                {STAGES.map(([stage, lots, price, share, discount]) => (
                  <tr key={stage} className={stage === "Stage 3" ? "on" : undefined}>
                    <td>
                      {stage}
                      {stage === "Stage 3" && <span className="tag tag-dark" style={{ marginLeft: 12 }}>Open now</span>}
                    </td>
                    <td>{lots}</td>
                    <td>{price}</td>
                    <td>{share}</td>
                    <td>{discount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="sec panel">
        <div className="wrap">
          <SectionHead eyebrow="Build at The ARK" title="Your Vision Fully Supported">
            Lots from 5,000m² with full support on everything you need to design and build your ideal home within The ARK.
          </SectionHead>
          <div className="pcards four">
            {HOMES.map(([name, status, specs, img]) => (
              <article key={name} className="pcard">
                <div className="ph">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${IMG}/${img}.webp`} alt={name} loading="lazy" />
                  <span className="tag">{status}</span>
                </div>
                <h3>{name}</h3>
                <span className="specs">{specs}</span>
              </article>
            ))}
          </div>
          <div className="card" style={{ padding: 32 }}>
            <ul className="checks two-col">
              {INCLUDED.map((i) => (
                <li key={i}>{i}</li>
              ))}
              <li>Only {left} homesites left</li>
            </ul>
            <div className="btn-row" style={{ marginTop: 16 }}>
              <Link className="btn btn-primary" href="/apply-stewardship">Become a steward</Link>
              <Link className="btn btn-ghost" href="/live-lot-prices">Lot prices</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="sec split">
        <div className="wrap">
          <div className="split-copy">
            <p className="eyebrow">Rental income potential</p>
            <h2>Your Home Works While You Don&apos;t</h2>
            <p>When you&apos;re not here, your home earns. Select a nightly rate to see your estimated annual passive income.</p>
            <p className="note">
              Estimated figures based on 70% average occupancy and published nightly rates. Subject to season, amenities, and
              availability.
            </p>
            <p className="note">*Ocean Vista - 2 bedroom at The ARK - avg rental $300/night</p>
          </div>
          <div className="card" style={{ flex: "999 1 480px", padding: 32 }}>
            <IncomeCalculator />
          </div>
        </div>
      </section>

      <section className="sec white">
        <div className="wrap">
          <SectionHead eyebrow="A regenerative economic model" title="Every business in the village shares its success with you">
            We believe the people who build a community should benefit from what it becomes. Every revenue stream within The
            ARK — after operational expenses — flows directly back to the stakeholders who make it possible.
          </SectionHead>
          <div className="cards">
            {BUSINESSES.map(([name, line]) => (
              <div key={name} className="card">
                <h3>{name}</h3>
                <p>{line}</p>
              </div>
            ))}
          </div>
          <div className="members-band dark" style={{ flexDirection: "column", alignItems: "flex-start" }}>
            <div>
              <p className="eyebrow">Village revenue pool</p>
              <h3>All businesses flow into one shared pool</h3>
              <p>→ Operational expenses deducted</p>
            </div>
            <div className="shares">
              {SHARES.map(([pct, who]) => (
                <div key={who}>
                  <strong>{pct}</strong>
                  <span>{who}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="note">*profit distributions expected to commence from 2028</p>
        </div>
      </section>

      <section className="sec split">
        <div className="wrap">
          <div className="split-copy">
            <p className="eyebrow">The ARK master plan</p>
            <h2>Find your place on the land</h2>
            <p>
              The ARK spans 80 hectares of rolling hills above Santa Teresa. Available lots are shown in the master plan
              below.
            </p>
            <Link className="btn btn-primary" href="/live-lot-prices">Lot prices</Link>
          </div>
          <div className="split-media">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${IMG}/master-plan-map-cfc323.webp`} alt="Master Plan Map" loading="lazy" style={{ objectFit: "contain" }} />
          </div>
        </div>
      </section>

      <section className="band-section">
        <div className="wrap members-band dark">
          <div>
            <p className="eyebrow">Reserve your lot</p>
            <h3>Only 100 families will ever call The ARK home. Will yours be one of them?</h3>
            <p>
              Only {left} homesites left. Stage 3 is now open. Lots are available from $375,000 with profit share, amenity
              access, and full construction support. Once sold, the only way in is through someone willing to leave.
            </p>
            <p>Finite supply. Infinite Happiness.</p>
          </div>
          <div className="btn-row">
            <Link className="btn btn-accent" href="/apply-stewardship">Become a steward</Link>
            <Link className="btn btn-ghost-light" href="/live-lot-prices">Lot prices</Link>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
