import type { Metadata } from "next";
import { loadPortal } from "@/lib/portal";
import { levelForPercent } from "@/lib/shopify-map";
import "../../shop.css";
import { Shop, type Group } from "./shop";

export const metadata: Metadata = { title: "Farm shop" };

export default async function PortalShop() {
  const p = await loadPortal();
  const [{ data: rows }, { data: pct }] = await Promise.all([
    p.supabase.rpc("shop_catalog"),
    p.supabase.rpc("my_court_discount"),
  ]);
  const percent = Number(pct) || 0;
  // One card per product, with its sizes or flavours as options.
  const groups = new Map<string, Group>();
  for (const r of rows ?? []) {
    const key = `${r.category}|${r.product_group}`;
    const g =
      groups.get(key) ??
      ({ key, name: r.product_group, category: r.category, image: r.image_url, description: r.description, url: r.web_url, options: [] } satisfies Group);
    g.options.push({ id: r.external_id, label: r.variant, price: Number(r.price) });
    g.image ??= r.image_url;
    groups.set(key, g);
  }
  return (
    <Shop
      groups={[...groups.values()]}
      percent={percent}
      code={levelForPercent(percent)?.code ?? null}
      email={p.me?.email ?? null}
    />
  );
}
