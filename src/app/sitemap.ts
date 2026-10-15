import type { MetadataRoute } from "next";

const SITE_ORIGIN = "https://theark.world";

// The public pages, the same addresses as the old GHL site plus the pages ARK OS added.
// Pages with an id or token in the address (events, stays, court bookings) are left out.
const PAGES: { path: string; priority: number }[] = [
  { path: "/home", priority: 1 },
  { path: "/ark-membership", priority: 0.9 },
  { path: "/whats-on", priority: 0.9 },
  { path: "/courts", priority: 0.9 },
  { path: "/farm-shop", priority: 0.9 },
  { path: "/stay", priority: 0.9 },
  { path: "/titled-lot-ownership", priority: 0.8 },
  { path: "/fractional-ownership", priority: 0.8 },
  { path: "/homes-for-sale", priority: 0.8 },
  { path: "/live-lot-prices", priority: 0.8 },
  { path: "/become-a-steward", priority: 0.8 },
  { path: "/apply-stewardship", priority: 0.7 },
  { path: "/ark-house", priority: 0.7 },
  { path: "/arkadia", priority: 0.7 },
  { path: "/philosophy", priority: 0.6 },
  { path: "/founder-bio", priority: 0.6 },
  { path: "/blog", priority: 0.6 },
  { path: "/faq", priority: 0.6 },
  { path: "/tenet-records", priority: 0.5 },
  { path: "/press-media", priority: 0.5 },
  { path: "/contribute", priority: 0.5 },
  { path: "/join", priority: 0.5 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map(({ path, priority }) => ({
    url: path === "/home" ? SITE_ORIGIN : `${SITE_ORIGIN}${path}`,
    priority,
  }));
}
