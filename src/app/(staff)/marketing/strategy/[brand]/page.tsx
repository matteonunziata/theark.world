import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { brandOf, crTime, fmtCr, listName, stageName } from "@/lib/marketing";
import { StrategyForm } from "./strategy-form";

export const metadata: Metadata = { title: "Brand strategy" };

export default async function BrandStrategy({ params }: PageProps<"/marketing/strategy/[brand]">) {
  const { brand: key } = await params;
  const brand = brandOf(key);
  if (!brand) notFound();
  const { supabase } = await requireStaff("marketing");
  const now = new Date().toISOString();
  const [{ data: s }, { data: refs }, { data: items }, { data: posts }, { data: campaigns }] = await Promise.all([
    supabase.from("brand_strategies").select("*, editor:team_members(name)").eq("brand", brand.key).maybeSingle(),
    supabase.from("brand_refs").select("*").eq("brand", brand.key).order("created_at", { ascending: false }),
    supabase
      .from("content_items")
      .select("id, title, stage, updated_at")
      .contains("brands", [brand.key])
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase
      .from("social_posts")
      .select("id, caption, scheduled_at, channels, status")
      .contains("brands", [brand.key])
      .gte("scheduled_at", now)
      .neq("status", "published")
      .order("scheduled_at")
      .limit(5),
    supabase
      .from("email_campaigns")
      .select("id, name, status, scheduled_at, sent_at, list_key")
      .contains("brands", [brand.key])
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  return (
    <>
      <Link className="ev-back" href="/marketing">← All brands</Link>
      <div className="brand-title" style={{ "--bc": `var(--${brand.color})` } as React.CSSProperties}>
        <i />
        <h2>{brand.name}</h2>
      </div>

      <div className="mk-summary">
        <section className="panel">
          <h3>Recent content</h3>
          {items?.length ? (
            <ul>
              {items.map((i) => (
                <li key={i.id}>
                  <Link href={`/marketing/content?brand=${brand.key}&item=${i.id}`}>{i.title}</Link>
                  <span className="muted">{stageName(i.stage)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No content for {brand.name} yet.</p>
          )}
        </section>
        <section className="panel">
          <h3>Upcoming posts</h3>
          {posts?.length ? (
            <ul>
              {posts.map((p) => (
                <li key={p.id}>
                  <Link href={`/marketing/social?brand=${brand.key}&d=${p.scheduled_at.slice(0, 10)}`}>
                    {p.caption.split("\n")[0] || "Untitled post"}
                  </Link>
                  <span className="muted">
                    {fmtCr(p.scheduled_at, { weekday: "short", month: "short", day: "numeric" })}, {crTime(p.scheduled_at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Nothing planned.</p>
          )}
        </section>
        <section className="panel">
          <h3>Email campaigns</h3>
          {campaigns?.length ? (
            <ul>
              {campaigns.map((c) => (
                <li key={c.id}>
                  <Link href={`/marketing/email/${c.id}`}>{c.name}</Link>
                  <span className="muted">
                    {c.status === "sent" && c.sent_at
                      ? `Sent ${fmtCr(c.sent_at, { month: "short", day: "numeric" })}`
                      : c.status === "scheduled" && c.scheduled_at
                        ? `Scheduled ${fmtCr(c.scheduled_at, { month: "short", day: "numeric" })}`
                        : "Draft"}
                    , {listName(c.list_key)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No campaigns yet.</p>
          )}
        </section>
      </div>

      <StrategyForm
        brand={brand.key}
        brandName={brand.name}
        strategy={s ?? null}
        editedBy={s?.editor?.name ?? null}
        refs={refs ?? []}
      />
    </>
  );
}
