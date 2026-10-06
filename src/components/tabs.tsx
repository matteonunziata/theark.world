"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Tabs({
  label,
  items,
}: {
  label: string;
  items: { href: string; label: string }[];
}) {
  const pathname = usePathname();
  // The deepest tab that covers the page is the current one, so a sub-page
  // like /settings/integrations/ghl still lights up Integrations.
  const current = items
    .filter((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav className="tabs" aria-label={label}>
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={current === t.href ? "page" : undefined}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
