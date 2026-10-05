import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { addDays, addMonths, todayIn, weekStart } from "@/lib/dates";
import { brandParam, fromCrLocal, isChannel } from "@/lib/marketing";
import { SocialCalendar } from "./social-calendar";

export const metadata: Metadata = { title: "Social planner" };

export default async function SocialPage({ searchParams }: PageProps<"/marketing/social">) {
  const sp = await searchParams;
  const brand = brandParam(sp.brand);
  const channel = isChannel(sp.channel) ? sp.channel : null;
  const view = sp.view === "week" ? "week" : "month";
  const today = todayIn();
  const anchor = typeof sp.d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : today;
  // The visible grid: whole weeks (Mon–Sun) covering the month, or one week.
  const first = view === "week" ? weekStart(anchor) : weekStart(`${anchor.slice(0, 7)}-01`);
  const monthEnd = addDays(`${addMonths(anchor.slice(0, 7), 1)}-01`, -1);
  const last = view === "week" ? addDays(first, 6) : addDays(weekStart(monthEnd), 6);

  const { supabase } = await requireStaff("marketing");
  let posts = supabase
    .from("social_posts")
    .select("*, social_post_assets(asset_id, position)")
    .gte("scheduled_at", fromCrLocal(`${first}T00:00`))
    .lt("scheduled_at", fromCrLocal(`${addDays(last, 1)}T00:00`))
    .order("scheduled_at");
  if (brand) posts = posts.contains("brands", [brand]);
  if (channel) posts = posts.contains("channels", [channel]);
  const [{ data: rows }, { data: assets }, { data: items }] = await Promise.all([
    posts,
    supabase.from("marketing_assets").select("id, title, kind, path, brands").neq("kind", "copy").order("created_at", { ascending: false }),
    supabase.from("content_items").select("id, title").in("stage", ["review", "approved", "published"]).order("updated_at", { ascending: false }).limit(50),
  ]);

  return (
    <SocialCalendar
      posts={(rows ?? []).map(({ social_post_assets, ...p }) => ({
        ...p,
        asset_ids: [...social_post_assets].sort((a, b) => a.position - b.position).map((a) => a.asset_id),
      }))}
      assets={assets ?? []}
      items={items ?? []}
      view={view}
      anchor={anchor}
      first={first}
      last={last}
      today={today}
      brand={brand}
      channel={channel}
    />
  );
}

