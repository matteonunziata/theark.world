import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { addDays, todayIn, weekStart } from "@/lib/dates";
import {
  brandParam,
  CHANNELS,
  channelName,
  crDate,
  fmtCr,
  fromCrLocal,
  pct,
  STAGES,
  STUCK_DAYS,
} from "@/lib/marketing";
import { BarList, Columns } from "./charts";
import { RangePicker } from "./range-picker";

export const metadata: Metadata = { title: "Marketing analytics" };

const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

export default async function AnalyticsPage({ searchParams }: PageProps<"/marketing/analytics">) {
  const sp = await searchParams;
  const brand = brandParam(sp.brand);
  const today = todayIn();
  const to = isDay(sp.to) ? sp.to : today;
  const from = isDay(sp.from) && sp.from <= to ? sp.from : addDays(to, -89);
  const start = fromCrLocal(`${from}T00:00`);
  const end = fromCrLocal(`${addDays(to, 1)}T00:00`);
  const { supabase } = await requireStaff("marketing");

  let campaigns = supabase
    .from("email_campaigns")
    .select("id, name, sent_at, list_key, email_sends(status, opened_at, clicked_at, unsubscribed_at, bounced_at)")
    .eq("status", "sent")
    .gte("sent_at", start)
    .lt("sent_at", end)
    .order("sent_at", { ascending: false });
  let posts = supabase
    .from("social_posts")
    .select("channels, published_at, reach, likes, comments, shares, saves")
    .eq("status", "published")
    .gte("published_at", start)
    .lt("published_at", end);
  let published = supabase
    .from("content_items")
    .select("published_at")
    .eq("stage", "published")
    .gte("published_at", start)
    .lt("published_at", end);
  let open = supabase.from("content_items").select("stage, stage_changed_at").neq("stage", "published");
  if (brand) {
    campaigns = campaigns.contains("brands", [brand]);
    posts = posts.contains("brands", [brand]);
    published = published.contains("brands", [brand]);
    open = open.contains("brands", [brand]);
  }
  const [{ data: camps }, { data: postRows }, { data: pubRows }, { data: openRows }, { data: leads }] =
    await Promise.all([
      campaigns,
      posts,
      published,
      open,
      supabase.rpc("marketing_leads", { p_from: from, p_to: to, p_brand: brand }),
    ]);

  // Email
  const emailRows = (camps ?? []).map((c) => {
    const s = c.email_sends.filter((x) => x.status === "sent");
    return {
      id: c.id,
      name: c.name,
      sent_at: c.sent_at!,
      sent: s.length,
      opened: s.filter((x) => x.opened_at).length,
      clicked: s.filter((x) => x.clicked_at).length,
      unsub: s.filter((x) => x.unsubscribed_at).length,
    };
  });
  const tot = emailRows.reduce(
    (a, r) => ({ sent: a.sent + r.sent, opened: a.opened + r.opened, clicked: a.clicked + r.clicked, unsub: a.unsub + r.unsub }),
    { sent: 0, opened: 0, clicked: 0, unsub: 0 },
  );

  // Social: a post on two channels counts once on each.
  const perChannel = CHANNELS.map(([k]) => {
    const ps = (postRows ?? []).filter((p) => p.channels.includes(k));
    const eng = ps.reduce((n, p) => n + (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0) + (p.saves ?? 0), 0);
    const reach = ps.reduce((n, p) => n + (p.reach ?? 0), 0);
    return { key: k, posts: ps.length, eng, reach };
  }).filter((c) => c.posts > 0);

  // Content: published per week (Mon–Sun), and what's sitting in each stage.
  const weeks: string[] = [];
  for (let w = weekStart(from); w <= to; w = addDays(w, 7)) weeks.push(w);
  const perWeek = weeks.map((w) => ({
    label: new Date(`${w}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
    value: (pubRows ?? []).filter((r) => r.published_at && weekStart(crDate(r.published_at)) === w).length,
  }));
  const stuckBefore = fromCrLocal(`${addDays(today, -STUCK_DAYS)}T23:59`);
  const stages = STAGES.filter(([k]) => k !== "published").map(([k, n]) => {
    const rows = (openRows ?? []).filter((r) => r.stage === k);
    const stuck = rows.filter((r) => new Date(r.stage_changed_at) <= new Date(stuckBefore)).length;
    return { label: n, value: stuck, note: `${stuck} of ${rows.length} for ${STUCK_DAYS}+ days` };
  });

  // Leads
  const bySource = new Map<string, number>();
  const byCampaign = new Map<string, { source: string; medium: string; n: number }>();
  for (const l of leads ?? []) {
    bySource.set(l.source, (bySource.get(l.source) ?? 0) + 1);
    if (l.campaign) {
      const key = `${l.source}|${l.campaign}`;
      const cur = byCampaign.get(key) ?? { source: l.source, medium: l.medium ?? "", n: 0 };
      byCampaign.set(key, { ...cur, n: cur.n + 1 });
    }
  }
  const sources = [...bySource].sort((a, b) => b[1] - a[1]);

  return (
    <>
      <RangePicker from={from} to={to} today={today} />

      <div className="kpis mk-kpis">
        <div className="kpi"><span>Waitlist signups</span><b>{leads?.length ?? 0}</b><small>{sources[0] ? `Most from ${sources[0][0]}` : "None in this range"}</small></div>
        <div className="kpi"><span>Emails sent</span><b>{tot.sent}</b><small>{pct(tot.opened, tot.sent)} opened, {pct(tot.clicked, tot.sent)} clicked</small></div>
        <div className="kpi"><span>Posts published</span><b>{postRows?.length ?? 0}</b><small>{perChannel.length} {perChannel.length === 1 ? "channel" : "channels"}</small></div>
        <div className="kpi"><span>Content published</span><b>{pubRows?.length ?? 0}</b><small>{stages.reduce((n, s) => n + s.value, 0)} items stuck</small></div>
      </div>

      <div className="mk-charts">
        <section className="panel">
          <h2>Waitlist signups by source</h2>
          <p className="muted chart-sub">From the UTM tags on the link they arrived from. “direct” has none.</p>
          <BarList rows={sources.map(([s, n]) => ({ label: s, value: n }))} empty="No signups in this range." />
          {byCampaign.size > 0 && (
            <div className="mk-table compact" style={{ marginTop: 14 }}>
              <div className="mk-tr head"><span>Campaign</span><span>Source</span><span>Medium</span><span>Signups</span></div>
              {[...byCampaign.entries()]
                .sort((a, b) => b[1].n - a[1].n)
                .map(([k, v]) => (
                  <div className="mk-tr" key={k}>
                    <span>{k.split("|")[1]}</span>
                    <span>{v.source}</span>
                    <span>{v.medium || "—"}</span>
                    <span>{v.n}</span>
                  </div>
                ))}
            </div>
          )}
        </section>

        <section className="panel">
          <h2>Content published per week</h2>
          <p className="muted chart-sub">Items moved to Published on the content board.</p>
          <Columns rows={perWeek} />
        </section>

        <section className="panel">
          <h2>Stuck in a stage</h2>
          <p className="muted chart-sub">Items that haven’t moved for {STUCK_DAYS} days or more, right now.</p>
          <BarList rows={stages} empty="" />
        </section>

        <section className="panel">
          <h2>Social posts by channel</h2>
          <p className="muted chart-sub">Published posts. Engagement is likes, comments, shares and saves, as entered.</p>
          <BarList
            rows={perChannel.map((c) => ({
              label: channelName(c.key),
              value: c.posts,
              note: `${c.eng.toLocaleString()} engagements${c.reach ? `, ${pct(c.eng, c.reach)} of ${c.reach.toLocaleString()} reached` : ""}`,
            }))}
            empty="No published posts in this range."
          />
        </section>
      </div>

      <section className="panel">
        <h2>Email campaigns</h2>
        {emailRows.length ? (
          <div className="mk-table">
            <div className="mk-tr head">
              <span>Campaign</span><span>Sent on</span><span>Sends</span><span>Opens</span><span>Clicks</span><span>Unsubscribes</span>
            </div>
            {emailRows.map((r) => (
              <Link key={r.id} href={`/marketing/email/${r.id}`} className="mk-tr">
                <span><b>{r.name}</b></span>
                <span>{fmtCr(r.sent_at, { month: "short", day: "numeric" })}</span>
                <span>{r.sent}</span>
                <span>{r.opened} <small className="muted">{pct(r.opened, r.sent)}</small></span>
                <span>{r.clicked} <small className="muted">{pct(r.clicked, r.sent)}</small></span>
                <span>{r.unsub}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="muted" style={{ margin: 0 }}>No campaigns sent in this range.</p>
        )}
      </section>
    </>
  );
}
