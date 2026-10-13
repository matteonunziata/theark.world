import Link from "next/link";
import type { Metadata } from "next";
import { loadPublicLots } from "@/lib/public-lots";
import { Finite } from "../site/finite";
import { SiteHero, SiteShell } from "../site/site-shell";
import { HOMES, HOMES_HERO, HOMES_INTRO } from "./homes-data";
import { resolveHome } from "./resolve";

export const metadata: Metadata = {
  title: { absolute: "Homes for sale — The ARK, Santa Teresa" },
  description:
    "Residences available within The ARK in Santa Teresa, Costa Rica: a rare opportunity to step directly into a regenerative community.",
};

// The order on the live site.
const ORDER = ["4", "1", "2", "3"];

export default async function HomesForSalePage() {
  const lots = await loadPublicLots();
  const homes = ORDER.map((id) => HOMES.find((h) => h.id === id)!);
  return (
    <SiteShell here="/homes-for-sale">
      <SiteHero eyebrow="Resale opportunities" title="Homes for Sale" sub={HOMES_INTRO} image={`/site/homes-for-sale/${HOMES_HERO}`} />
      <section className="sec">
        <div className="wrap">
          <div className="pcards two-up">
            {homes.map((h) => {
              const { sold, price } = resolveHome(h, lots);
              const href = `/homes-for-sale/${h.id}`;
              return (
                <article key={h.id} className={`pcard${sold ? " off" : ""}`}>
                  <div className="ph">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/site/homes-for-sale/${h.cover}`} alt={h.name} loading="lazy" />
                    <span className="tag">{sold ? "Sold" : "Available"}</span>
                  </div>
                  <h3><Link href={href}>{h.name}</Link></h3>
                  <span className="specs">{h.beds} Beds · {h.baths} Baths · {h.living}</span>
                  <p>{h.summary}</p>
                  <div className="foot">
                    <strong>{price}</strong>
                    <span className="btn-row">
                      <Link className="btn btn-ghost" href={href}>View details</Link>
                      {!sold && <Link className="btn btn-primary" href="/apply-stewardship">I&apos;m interested</Link>}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
      <Finite />
    </SiteShell>
  );
}
