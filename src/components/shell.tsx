"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AskAi, AskAiPanel } from "@/components/ask-ai";
import { Icon } from "@/components/icons";
import { Logo } from "@/components/logo";
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
        <Link href="/" aria-label="Home">
          <Logo height={24} />
        </Link>
        <AskAi variant="bar" />
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
        <Link href="/" className="brand" aria-label="ARK OS home">
          <Logo height={30} />
          <small>OS</small>
        </Link>
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
        </nav>
        <div className="side-foot">
          <span className="who-me">
            <b>{me.name}</b>
            {roleName(me.role)}
          </span>
          <a className="linkish side-portal" href="/portal">
            Member portal
          </a>
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
      <main className="main">
        <div className="main-top">
          <a className="btn" href="/portal">
            Member portal
          </a>
          <AskAi />
        </div>
        {children}
      </main>
      <AskAiPanel />
    </div>
  );
}
