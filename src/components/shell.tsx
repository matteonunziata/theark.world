"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { type ModuleKey, roleName } from "@/lib/roles";

type NavItem = { key: ModuleKey; name: string; href: string; planned?: boolean };

export function Shell({
  nav,
  place,
  me,
  children,
}: {
  nav: NavItem[];
  place: string;
  me: { name: string; role: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const current = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="app">
      <div className="topbar">
        <div className="mark">ARK</div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="side"
          onClick={() => setOpen(!open)}
        >
          Menu
        </button>
      </div>
      <aside className={`side ${open ? "open" : ""}`} id="side">
        <div className="mark">
          ARK <small>OS</small>
        </div>
        <div className="place">{place}</div>
        {/* Close the mobile menu when a link is chosen. */}
        <nav className="nav" aria-label="Modules" onClick={() => setOpen(false)}>
          {nav.map((m) => (
            <span key={m.key} style={{ display: "contents" }}>
              {m.key === "settings" && <div className="gap" />}
              <Link
                href={m.href}
                aria-current={current(m.href) ? "page" : undefined}
              >
                <Icon name={m.key} />
                {m.name}
                {m.planned && <span className="later">Soon</span>}
              </Link>
            </span>
          ))}
          <Link href="/portal" target="_blank">
            <Icon name="portal" />
            Members portal
          </Link>
        </nav>
        <div className="side-foot">
          <span className="who-me">
            <b>{me.name}</b>
            {roleName(me.role)}
          </span>
          <form action="/auth/signout" method="post">
            <button type="submit" className="linkish">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <button
        type="button"
        className="scrim-side"
        aria-label="Close menu"
        tabIndex={-1}
        onClick={() => setOpen(false)}
      />
      <main className="main">{children}</main>
    </div>
  );
}
