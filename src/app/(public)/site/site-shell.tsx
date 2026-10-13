import Image from "next/image";
import Link from "next/link";
import { ArkFonts } from "@/components/ark-fonts";
import { Logo } from "@/components/logo";
import { getViewer } from "@/lib/auth";
import { loadPublicLots, titledLotsLeft } from "@/lib/public-lots";
import { NavMenu } from "./nav-menu";
import { BrochureForm } from "./forms";
import "../whats-on/events.css";
import "./site.css";

const LOTS_TOTAL = 87;

const groups = (left: number) =>
  [
    { label: "Shop", items: [["The Farm Shop", "/farm-shop"]], note: "Farm-fresh food, delivered" },
    {
      label: "Stewardship",
      items: [
        ["Interactive Map & Prices", "/live-lot-prices"],
        ["Titled Lots", "/titled-lot-ownership"],
        ["Fractional Ownership", "/fractional-ownership"],
        ["Homes for Sale", "/homes-for-sale"],
      ],
      note: `Limited Opportunity · ${left}/${LOTS_TOTAL} lots available`,
    },
    {
      label: "The Village",
      items: [
        ["The ARK Membership", "/ark-membership"],
        ["The ARK Events", "/whats-on"],
        ["The ARK Farm", "/farm-shop"],
        ["The ARK House", "/ark-house"],
        ["The ARK Padel", "/courts"],
        ["Arkadia", "/about-arkadia"],
        ["Tenet Records", "/tenet-records"],
      ],
      note: "Where we live, learn, work, play, and gather",
    },
    {
      label: "Visit",
      items: [
        ["The ARK Rentals", "/stay"],
        ["The ARK Events", "/whats-on"],
        ["The ARK Membership", "/ark-membership"],
      ],
      note: "Spend the day or stay at The ARK",
    },
    {
      label: "Contribute",
      items: [
        ["Host a Retreat / Event", "/contribute"],
        ["Teach or Perform", "/contribute"],
        ["Creator Opportunities", "/contribute"],
      ],
      note: "Over 300 attendees at Wellness Summit",
    },
    {
      label: "Story",
      items: [
        ["Founder Bio", "/founder-bio"],
        ["Philosophy", "/philosophy"],
        ["FAQ", "/faq"],
        ["Press & Media", "/press-media"],
        ["Blog", "/blog"],
      ],
      note: "Santa Teresa · Nicoya Peninsula · Blue Zone",
    },
  ] as const;

/** Nav, page frame and footer shared by the information pages. Same markup and classes as Stay and Events. */
export const BROCHURE = "/site/brochure/the-ark-stewardship-brochure.pdf";

export async function SiteShell({ children, here, brochure = true }: { children: React.ReactNode; here: string; brochure?: boolean }) {
  const [{ memberId, staff }, lots] = await Promise.all([getViewer(), loadPublicLots()]);
  return (
    <main className="evp sx">
      <ArkFonts />
      <header>
        <nav aria-label="Main">
          <Link href="/home" aria-label="The ARK">
            <Logo tone="dark" height={40} />
          </Link>
          <NavMenu groups={groups(titledLotsLeft(lots))} here={here} />
          <div className="nav-right">
            {staff ? (
              <Link href="/estate" className="btn btn-primary sm">Staff view</Link>
            ) : memberId ? (
              <Link href="/portal" className="btn btn-primary sm">Sign in</Link>
            ) : (
              <>
                <Link className="nav-login" href={`/portal/login?next=${here}`}>Sign in</Link>
                <Link className="btn btn-primary sm" href="/apply-stewardship">Become a steward</Link>
              </>
            )}
          </div>
        </nav>
      </header>
      {children}
      {brochure && (
        <section className="host sec white">
          <div className="wrap">
            <div className="host-copy">
              <h2>Become a Steward</h2>
              <p>Download our comprehensive brochure to learn more about the vision, the land, and how you can be part of The ARK.</p>
            </div>
            <BrochureForm href={BROCHURE} />
          </div>
        </section>
      )}
      <footer className="dark">
        <div className="wrap">
          <span className="brand">
            <Logo tone="light" kind="mark" height={32} /> Santa Teresa, Costa Rica
          </span>
          <div className="links">
            <Link href="/ark-membership">Membership</Link>
            <Link href="/courts">Courts</Link>
            <Link href="/stay">Stay</Link>
            <Link href="/whats-on">Events</Link>
            <Link href="/farm-shop">Farm Shop</Link>
            <Link href="/faq">FAQ</Link>
            <Link href="/press-media">Press</Link>
            <Link href={`/portal/login?next=${here}`}>Sign in</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

/** Page hero. With an image: photo behind forest gradient (Stay). Without: solid forest (Events). */
export function SiteHero({
  eyebrow,
  title,
  sub,
  image,
  video,
  className,
  children,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  image?: string;
  /** Looping background video; `image` is its poster and the fallback. */
  video?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <section
      className={`hero dark${image ? " has-img" : ""}${className ? ` ${className}` : ""}`}
      style={video && image ? { background: `center / cover url(${image})` } : undefined}
    >
      {image && !video && <Image src={image} alt="" fill priority sizes="100vw" className="bg" />}
      {video && (
        <video className="bg" src={video} poster={image} autoPlay muted loop playsInline preload="auto" aria-hidden="true" />
      )}
      <div className="wrap">
        <div className="hero-copy">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1>{title}</h1>
          {sub && <p className="hero-sub">{sub}</p>}
          {children && <div className="btn-row">{children}</div>}
        </div>
      </div>
    </section>
  );
}

/** Eyebrow and h2 on the left, a short line on the right. */
export function SectionHead({ eyebrow, title, children }: { eyebrow?: string; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="section-head">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
      </div>
      {children && <p>{children}</p>}
    </div>
  );
}

/** Closing call to action: the forest band used at the end of Courts, Events and Stay. */
export function Band({ title, children, actions }: { title: string; children?: React.ReactNode; actions: React.ReactNode }) {
  return (
    <section className="band-section">
      <div className="wrap members-band dark">
        <div>
          <h3>{title}</h3>
          {children && <p>{children}</p>}
        </div>
        <div className="btn-row">{actions}</div>
      </div>
    </section>
  );
}

/** An answer's paragraphs; runs of lines starting with a bullet become one list. */
function blocks(answer: string): (string | string[])[] {
  const out: (string | string[])[] = [];
  for (const para of answer.split(/\n\s*\n/)) {
    const item = para.startsWith("•") ? para.replace(/^•\s*/, "") : null;
    const last = out[out.length - 1];
    if (item !== null && Array.isArray(last)) last.push(item);
    else if (item !== null) out.push([item]);
    else out.push(para);
  }
  return out;
}

/** Question and answer pairs, one open at a time (Memberships FAQ). */
export function Faq({ items, name = "faq" }: { items: readonly (readonly [string, string])[]; name?: string }) {
  return (
    <div className="faq">
      {items.map(([q, a]) => (
        <details key={q} name={name}>
          <summary>{q}</summary>
          {blocks(a).map((b, i) =>
            Array.isArray(b) ? (
              <ul key={i} className="checks">
                {b.map((li) => (
                  <li key={li}>{li}</li>
                ))}
              </ul>
            ) : (
              <p key={i}>{b}</p>
            ),
          )}
        </details>
      ))}
    </div>
  );
}
