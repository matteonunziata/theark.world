import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { listStripePrices, stripeReady } from "@/lib/stripe";
import { TiersView } from "./tiers-view";

export const metadata: Metadata = { title: "Tiers & pricing" };

export default async function TiersPage() {
  const { supabase, staff } = await requireStaff("memberships");
  const [{ data: tiers }, { data: discounts }, { data: counts }, { data: used }] =
    await Promise.all([
      supabase.from("membership_tiers").select("*").order("position"),
      supabase.from("discounts").select("*").order("name"),
      supabase.rpc("tier_counts"),
      supabase.from("contacts").select("discount_id").not("discount_id", "is", null),
    ]);
  const stripePrices = stripeReady() ? await listStripePrices().catch(() => []) : [];
  return (
    <TiersView
      stripePrices={stripePrices}
      tiers={tiers ?? []}
      discounts={discounts ?? []}
      counts={Object.fromEntries((counts ?? []).map((c) => [c.tier, Number(c.active)]))}
      discountUse={(used ?? []).reduce<Record<string, number>>((m, c) => {
        m[c.discount_id!] = (m[c.discount_id!] ?? 0) + 1;
        return m;
      }, {})}
      canEdit={staff.role === "admin"}
    />
  );
}
