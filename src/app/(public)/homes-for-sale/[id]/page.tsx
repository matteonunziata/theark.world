import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { loadPublicLots } from "@/lib/public-lots";
import { Finite } from "../../site/finite";
import { SiteHero, SiteShell } from "../../site/site-shell";
import { HOMES } from "../homes-data";
import { resolveHome } from "../resolve";

export async function generateMetadata({ params }: PageProps<"/homes-for-sale/[id]">): Promise<Metadata> {
  const { id } = await params;
  const h = HOMES.find((x) => x.id === id);
  if (!h) return {};
  return {
    title: { absolute: `${h.name} — Homes for sale at The ARK, Santa Teresa` },
    description: h.summary,
  };
}

export default async function HomePage({ params }: PageProps<"/homes-for-sale/[id]">) {
  const { id } = await params;
  const h = HOMES.find((x) => x.id === id);
  if (!h) notFound();
  const { sold, price } = resolveHome(h, await loadPublicLots());
  const dir = `/site/homes-for-sale-${h.id}`;
  const [lead, ...rest] = h.after;
  return (
    <SiteShell here="/homes-for-sale">
      <SiteHero eyebrow={sold ? "Sold" : "Available"} title={h.name} sub={`The ARK, Santa Teresa · ${price}`} image={`${dir}/${h.gallery[0]}`}>
        <Link className="btn btn-ghost-light" href="/homes-for-sale">Back to listings</Link>
      </SiteHero>

      {sold && (
        <section className="sec" style={{ paddingBottom: 0 }}>
          <div className="wrap">
            <div className="card" style={{ padding: 32 }}>
              <h3>{h.name} is Sold</h3>
              <p>This property is no longer available. We invite you to explore other beautiful residences currently available within The ARK.</p>
              <Link className="btn btn-primary" href="/homes-for-sale">View homes</Link>
            </div>
          </div>
        </section>
      )}

      <section className="sec">
        <div className="wrap">
          <div className="cards four">
            {(
              [
                [h.beds, "Bedrooms"],
                [h.baths, "Bathrooms"],
                [h.living, "Living area"],
                [h.lotSize, "Lot size"],
              ] as const
            ).map(([v, k]) => (
              <div key={k} className="card">
                <span className="eyebrow">{k}</span>
                <h3>{v}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sec split panel">
        <div className="wrap">
          <div className="split-copy">
            <h2>About the Property</h2>
            <p>{h.about}</p>
          </div>
          <div className="card" style={{ flex: "999 1 420px", padding: 32 }}>
            <h3>Features &amp; Amenities</h3>
            <ul className="checks">
              {h.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          <h2>Gallery</h2>
          <div className="gallery">
            {h.gallery.map((g, i) => (
              <div key={g} className="g">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${dir}/${g}`} alt={`${h.name} - View ${i + 1}`} loading="lazy" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="band-section">
        <div className="wrap members-band dark">
          <div>
            <h3>{lead.replace(/^### /, "")}</h3>
            <p>{rest[0]}</p>
          </div>
          <div className="btn-row">
            {sold ? (
              <Link className="btn btn-accent" href="/homes-for-sale">View homes</Link>
            ) : (
              <Link className="btn btn-accent" href="/apply-stewardship">I&apos;m interested</Link>
            )}
          </div>
        </div>
      </section>
      <Finite />
    </SiteShell>
  );
}
