import Link from "next/link";
import { loadPublicLots, titledLotsLeft } from "@/lib/public-lots";

/** One review, as on the live site. */
export function Review() {
  return (
    <section className="sec">
      <div className="wrap">
        <div className="quotes">
          <figure className="quote">
            <span className="stars" aria-label="Five stars">★★★★★</span>
            <blockquote>
              &ldquo;We spent six months researching eco-communities across three continents. The ARK was the only one where
              the founder answered the phone and the residents vouched without prompting.&rdquo;
            </blockquote>
            <figcaption>Sophie &amp; Kai — Netherlands · Family · 2 children</figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}

/** "Finite Opportunity, Infinite Happiness": the closing call to become a steward, with the lots still for sale. */
export async function Finite({ review = true }: { review?: boolean }) {
  const left = titledLotsLeft(await loadPublicLots());
  return (
    <>
      <section className="sec split white">
        <div className="wrap">
          <div className="split-copy">
            <p className="eyebrow">Stewardship</p>
            <h2>Finite Opportunity Infinite Happiness</h2>
            <p>Only 100 families will ever call The ARK home. Will yours be one of them?</p>
            <Link className="btn btn-primary" href="/apply-stewardship">Become one of the 100</Link>
            <p className="note">
              Stage 3 pricing · {left} lots remaining · Prices increase with next stage
            </p>
          </div>
          <div className="split-media">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/site/shared/master-plan.webp" alt="The ARK Master Plan" loading="lazy" />
          </div>
        </div>
      </section>
      {review && <Review />}
    </>
  );
}
