"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";

const NAV = [
  { href: "/portal", label: "Home", icon: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/>' },
  { href: "/portal/schedule", label: "Schedule", icon: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/>' },
  { href: "/portal/people", label: "People", icon: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.9.7 3.1 2.4 3.5 5.2"/>' },
  { href: "/portal/shop", label: "Shop", icon: '<path d="M5 8h14l-1.2 11.2a1.5 1.5 0 0 1-1.5 1.3H7.7a1.5 1.5 0 0 1-1.5-1.3z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>' },
  { href: "/portal/guests", label: "Guests", icon: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5"/><path d="M18 11v6M15 14h6"/>' },
];
const PROPERTY = {
  href: "/portal/property",
  label: "My Property",
  short: "Property",
  icon: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',
};
const ME = { href: "/portal/me", label: "Me", icon: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.2-6 8-6s7 2 8 6"/>' };

export function PortalShell({
  initials,
  isStaff,
  isMember,
  hasProperty,
  children,
}: {
  initials: string;
  isStaff: boolean;
  /** Team members are members too, so they can have both. */
  isMember: boolean;
  /** Members who own a lot get a My Property tab. */
  hasProperty: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const nav = hasProperty ? [...NAV, PROPERTY] : NAV;
  const tabs = [...nav, ME];
  const current = (href: string) =>
    href === "/portal" ? pathname === "/portal" : pathname.startsWith(href);

  return (
    <>
      <header className="pv-top">
        <div className="pv-top-in">
          <Link href="/portal" className="pv-logo" aria-label="The ARK home">
            <Logo tone="dark" height={26} />
          </Link>
          <nav className="pv-nav" aria-label="Portal">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} aria-current={current(n.href) ? "page" : undefined}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="pv-top-r">
            {isStaff && (
              <Link className="pv-btn ghost sm" href="/">
                Staff view
              </Link>
            )}
            {isMember && (
              <Link className="pv-btn sm pv-passlink" href="/portal/pass" aria-label="My pass" aria-current={pathname === "/portal/pass" ? "page" : undefined}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <path d="M14 14h3v3h-3zM20 20h1M17 20h1" />
                </svg>
                <span className="t">My pass</span>
              </Link>
            )}
            <Link className="pv-me" href="/portal/me" aria-label="Your profile">
              {initials}
            </Link>
          </div>
        </div>
      </header>
      <main className="pv-main">{children}</main>
      <nav className="pv-tabbar" aria-label="Portal">
        {tabs.map((n) => (
          <Link key={n.href} href={n.href} aria-current={current(n.href) ? "page" : undefined}>
            <svg viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: n.icon }} />
            {(n as { short?: string }).short ?? n.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
