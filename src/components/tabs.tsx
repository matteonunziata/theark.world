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
  return (
    <nav className="tabs" aria-label={label}>
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={pathname === t.href ? "page" : undefined}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
