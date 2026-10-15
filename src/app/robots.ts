import type { MetadataRoute } from "next";

const SITE_ORIGIN = "https://theark.world";

// Everything public is open. Staff areas, the members' portal, sign-in and the per-person
// links in emails (tickets, passes, guest and payment links) stay out of search.
const PRIVATE = [
  "/api/", "/auth/", "/login", "/choose", "/no-access", "/portal", "/steward", "/facilitator",
  "/dashboard", "/crm", "/events", "/classes", "/memberships", "/shop", "/finance", "/marketing",
  "/operations", "/hospitality", "/estate", "/gate", "/security", "/settings", "/tech", "/admin-schedule",
  "/t/", "/g/", "/p/", "/u/", "/family/", "/pay/", "/qr", "/courts/b/", "/courts/join/",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: PRIVATE },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
    host: SITE_ORIGIN,
  };
}
