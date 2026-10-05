import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { brandParam } from "@/lib/marketing";
import { ContentBoard } from "./content-board";
import { ContentTabs } from "./content-tabs";

export const metadata: Metadata = { title: "Content" };

export default async function ContentPage({ searchParams }: PageProps<"/marketing/content">) {
  const sp = await searchParams;
  const brand = brandParam(sp.brand);
  const { supabase, staff } = await requireStaff("marketing");
  let items = supabase
    .from("content_items")
    .select("*, content_item_assets(asset_id), content_comments(id, body, created_at, author:team_members(name))")
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (brand) items = items.contains("brands", [brand]);
  const [{ data: rows }, { data: assets }, { data: team }] = await Promise.all([
    items,
    supabase.from("marketing_assets").select("id, title, kind, path, brands").order("created_at", { ascending: false }),
    supabase.from("team_members").select("id, name").eq("status", "active").in("role", ["admin", "marketing", "lead", "sales"]).order("name"),
  ]);
  return (
    <>
      <ContentTabs />
      <ContentBoard
        items={(rows ?? []).map((r) => ({
          ...r,
          asset_ids: r.content_item_assets.map((a) => a.asset_id),
          comments: [...r.content_comments]
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
            .map((c) => ({ id: c.id, body: c.body, created_at: c.created_at, author: c.author?.name ?? null })),
        }))}
        assets={assets ?? []}
        team={team ?? []}
        me={staff.id}
        brand={brand}
        openId={typeof sp.item === "string" ? sp.item : null}
      />
    </>
  );
}
