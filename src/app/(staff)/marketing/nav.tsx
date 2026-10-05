"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BRANDS, brandParam } from "@/lib/marketing";

const TABS = [
  { href: "/marketing", label: "Strategy" },
  { href: "/marketing/content", label: "Content" },
  { href: "/marketing/social", label: "Social" },
  { href: "/marketing/email", label: "Email" },
  { href: "/marketing/analytics", label: "Analytics" },
];

/** Section tabs plus the brand filter, which every section reads from ?brand=. */
export function MarketingNav() {
  const path = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const brand = brandParam(params.get("brand") ?? undefined);
  const q = brand ? `?brand=${brand}` : "";
  const current = (href: string) =>
    href === "/marketing" ? path === href || path.startsWith("/marketing/strategy") : path.startsWith(href);

  const pick = (b: string | null) => {
    const next = new URLSearchParams(params);
    if (b) next.set("brand", b);
    else next.delete("brand");
    // A brand's strategy page follows the filter.
    const base = path.startsWith("/marketing/strategy/") && b ? `/marketing/strategy/${b}` : path;
    router.push(`${base}${next.size ? `?${next}` : ""}`);
  };

  return (
    <>
      <nav className="tabs" aria-label="Marketing sections">
        {TABS.map((t) => (
          <Link key={t.href} href={`${t.href}${q}`} aria-current={current(t.href) ? "page" : undefined}>
            {t.label}
          </Link>
        ))}
      </nav>
      <div className="brand-bar" role="group" aria-label="Filter by brand">
        <button type="button" className="pill" aria-pressed={!brand} onClick={() => pick(null)}>
          All brands
        </button>
        {BRANDS.map((b) => (
          <button
            key={b.key}
            type="button"
            className="pill brand-pill"
            aria-pressed={brand === b.key}
            style={{ "--bc": `var(--${b.color})` } as React.CSSProperties}
            onClick={() => pick(brand === b.key ? null : b.key)}
          >
            <i />
            {b.name}
          </button>
        ))}
      </div>
    </>
  );
}

/** Small coloured brand tags. */
export function BrandTags({ brands }: { brands: string[] }) {
  return (
    <span className="btags">
      {brands.map((k) => {
        const b = BRANDS.find((x) => x.key === k);
        return b ? (
          <span key={k} className="btag" style={{ "--bc": `var(--${b.color})` } as React.CSSProperties}>
            {b.name}
          </span>
        ) : null;
      })}
    </span>
  );
}

/** Checkboxes for picking brands in a form (submitted as repeated "brands"). */
export function BrandPicker({ value, name = "brands" }: { value: string[]; name?: string }) {
  return (
    <fieldset className="fld" style={{ border: 0, padding: 0, margin: "0 0 14px" }}>
      <legend className="lbl" style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 6 }}>Brands</legend>
      <div className="chk-row">
        {BRANDS.map((b) => (
          <label key={b.key} className="chk-pill" style={{ "--bc": `var(--${b.color})` } as React.CSSProperties}>
            <input type="checkbox" name={name} value={b.key} defaultChecked={value.includes(b.key)} />
            <span>{b.name}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
