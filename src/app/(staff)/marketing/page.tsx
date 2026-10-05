import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { BRANDS, brandParam } from "@/lib/marketing";

export const metadata: Metadata = { title: "Marketing" };

const FIELDS = ["story", "audience", "key_messages", "pillars", "tone", "channels", "goals"] as const;

export default async function StrategyOverview({ searchParams }: PageProps<"/marketing">) {
  const brand = brandParam((await searchParams).brand);
  if (brand) redirect(`/marketing/strategy/${brand}?brand=${brand}`);
  const { supabase } = await requireStaff("marketing");
  const now = new Date().toISOString();
  const [{ data: strategies }, { data: items }, { data: posts }, { data: campaigns }] = await Promise.all([
    supabase.from("brand_strategies").select("*"),
    supabase.from("content_items").select("brands, stage"),
    supabase.from("social_posts").select("brands").gte("scheduled_at", now).neq("status", "published"),
    supabase.from("email_campaigns").select("brands, status"),
  ]);
  const count = <T extends { brands: string[] }>(rows: T[] | null, b: string, f: (r: T) => boolean = () => true) =>
    (rows ?? []).filter((r) => r.brands.includes(b) && f(r)).length;

  return (
    <div className="brand-grid">
      {BRANDS.map((b) => {
        const s = strategies?.find((x) => x.brand === b.key);
        const filled = s ? FIELDS.filter((f) => s[f]?.trim()).length : 0;
        return (
          <Link
            key={b.key}
            href={`/marketing/strategy/${b.key}`}
            className="brand-card"
            style={{ "--bc": `var(--${b.color})` } as React.CSSProperties}
          >
            <span className="bar" />
            <h2>{b.name}</h2>
            <span className="muted">
              {filled ? `Strategy ${filled} of ${FIELDS.length} sections written` : "Strategy not written yet"}
            </span>
            <dl>
              <div>
                <dt>In the works</dt>
                <dd>{count(items, b.key, (i) => i.stage !== "published")}</dd>
              </div>
              <div>
                <dt>Posts coming up</dt>
                <dd>{count(posts, b.key)}</dd>
              </div>
              <div>
                <dt>Campaigns</dt>
                <dd>{count(campaigns, b.key)}</dd>
              </div>
            </dl>
          </Link>
        );
      })}
    </div>
  );
}
