import Link from "next/link";
import { Logo } from "@/components/logo";
import { getViewer } from "@/lib/auth";
import { loadPublicLots, titledLotsLeft } from "@/lib/public-lots";
import { NavMenu } from "./nav-menu";
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

/** The main menu bar, identical on every public page. Render inside an `.evp.sx` frame (SiteShell) or use SiteNavBar. */
export async function SiteNav({ here }: { here: string }) {
  const [{ memberId, staff }, lots] = await Promise.all([getViewer(), loadPublicLots()]);
  return (
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
  );
}

/** The same bar for pages with their own frame (Courts, Farm shop, Membership, Stay, Events). */
export function SiteNavBar({ here }: { here: string }) {
  return (
    <div className="evp sx site-nav">
      <SiteNav here={here} />
    </div>
  );
}
