"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Tabs({
  label,
  items,
}: {
  label: string;
  items: { href: string; label: string; also?: string[] }[];
}) {
  const pathname = usePathname();
  // The deepest tab that covers the page is the current one, so a sub-page
  // like /settings/integrations/ghl still lights up Integrations.
  // `also` lists other paths that belong under the same tab.
  const covers = (t: { href: string; also?: string[] }, base: string) => pathname === base || pathname.startsWith(`${base}/`);
  const current = items
    .flatMap((t) => [t.href, ...(t.also ?? [])].filter((b) => covers(t, b)).map((b) => ({ href: t.href, len: b.length })))
    .sort((a, b) => b.len - a.len)[0]?.href;
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
