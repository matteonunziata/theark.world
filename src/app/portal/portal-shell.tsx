"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { Logo } from "@/components/logo";
import { setCity } from "./actions";

const NAV = [
  { href: "/portal", label: "Home", icon: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/>' },
  { href: "/portal/schedule", label: "Schedule", icon: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/>' },
  { href: "/portal/explore", label: "Explore", icon: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>' },
  { href: "/portal/people", label: "People", icon: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.9.7 3.1 2.4 3.5 5.2"/>' },
  { href: "/portal/guests", label: "Guests", icon: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5"/><path d="M18 11v6M15 14h6"/>' },
  { href: "/portal/feed", label: "Feed", icon: '<path d="M4 6h16M4 12h16M4 18h10"/>' },
  { href: "/portal/messages", label: "Messages", icon: '<path d="M4 5h16v11H8l-4 4z"/>' },
];
const ME = { href: "/portal/me", label: "Me", icon: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.2-6 8-6s7 2 8 6"/>' };

export function PortalShell({
  cities,
  cityId,
  initials,
  unread,
  isStaff,
  children,
}: {
  cities: { id: string; name: string }[];
  cityId: string | null;
  initials: string;
  unread: number;
  isStaff: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, start] = useTransition();
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
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} aria-current={current(n.href) ? "page" : undefined}>
                {n.label}
                {n.href === "/portal/messages" && unread > 0 && (
                  <span className="dot" aria-label={`${unread} unread`} />
                )}
              </Link>
            ))}
          </nav>
          <div className="pv-top-r">
            {cities.length > 1 && (
              <label className="pv-city">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
                  <circle cx="12" cy="9.5" r="2.5" />
                </svg>
                <select
                  aria-label="Your city"
                  value={cityId ?? ""}
                  disabled={pending}
                  onChange={(e) =>
                    start(async () => {
                      await setCity(e.target.value);
                      router.refresh();
                    })
                  }
                >
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
            )}
            {isStaff && (
              <Link className="pv-btn ghost sm" href="/memberships">
                Staff view
              </Link>
            )}
            {!isStaff && (
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
        {[...NAV.filter((n) => n.href !== "/portal/explore" && n.href !== "/portal/guests"), ME].map((n) => (
          <Link key={n.href} href={n.href} aria-current={current(n.href) ? "page" : undefined}>
            <svg viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: n.icon }} />
            {n.label}
            {n.href === "/portal/messages" && unread > 0 && <span className="dot" />}
          </Link>
        ))}
      </nav>
    </>
  );
}
