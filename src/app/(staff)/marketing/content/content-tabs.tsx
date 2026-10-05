"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export function ContentTabs() {
  const path = usePathname();
  const brand = useSearchParams().get("brand");
  const q = brand ? `?brand=${brand}` : "";
  return (
    <div className="pill-row" role="group" aria-label="Content views">
      <Link className="pill" aria-current={path === "/marketing/content" ? "page" : undefined} href={`/marketing/content${q}`}>
        Pipeline
      </Link>
      <Link className="pill" aria-current={path === "/marketing/content/library" ? "page" : undefined} href={`/marketing/content/library${q}`}>
        Asset library
      </Link>
    </div>
  );
}
