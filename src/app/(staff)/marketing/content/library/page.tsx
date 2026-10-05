import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { brandParam } from "@/lib/marketing";
import { ContentTabs } from "../content-tabs";
import { LibraryView } from "./library-view";

export const metadata: Metadata = { title: "Asset library" };

export default async function LibraryPage({ searchParams }: PageProps<"/marketing/content/library">) {
  const sp = await searchParams;
  const brand = brandParam(sp.brand);
  const { supabase } = await requireStaff("marketing");
  let q = supabase
    .from("marketing_assets")
    .select("*, content_item_assets(item_id), social_post_assets(post_id)")
    .order("created_at", { ascending: false });
  if (brand) q = q.contains("brands", [brand]);
  const { data } = await q;
  return (
    <>
      <ContentTabs />
      <LibraryView
        assets={(data ?? []).map(({ content_item_assets, social_post_assets, ...a }) => ({
          ...a,
          uses: content_item_assets.length + social_post_assets.length,
        }))}
        brand={brand}
      />
    </>
  );
}
