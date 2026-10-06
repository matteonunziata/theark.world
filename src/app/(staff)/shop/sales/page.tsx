import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { addDays, todayIn } from "@/lib/dates";
import { crStart } from "@/lib/shop-report";
import { SalesView } from "./sales-view";

export const metadata: Metadata = { title: "Farm shop sales" };

const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** The ledger shows at most this many lines; narrow the range for more. */
const LEDGER_MAX = 1000;

export default async function SalesPage({ searchParams }: PageProps<"/shop/sales">) {
  const sp = await searchParams;
  const today = todayIn();
  const to = isDay(sp.to) ? sp.to : today;
  const from = isDay(sp.from) && sp.from <= to ? sp.from : addDays(to, -6);
  const { supabase, staff } = await requireStaff("shop");
  const [{ data: moves }, { data: products }, { data: org }] = await Promise.all([
    supabase
      .from("stock_movements")
      .select(
        "id, type, delta, amount, unit_price, method, order_id, contact_id, created_at, product:products(name, unit, category), contact:contacts(name), by:team_members(name)",
      )
      .gte("created_at", crStart(from))
      .lt("created_at", crStart(addDays(to, 1)))
      .order("created_at", { ascending: false })
      .limit(LEDGER_MAX),
    supabase
      .from("products")
      .select("id, name, price, member_price, stock, track_stock, unit, category, online")
      .eq("active", true)
      .order("name"),
    supabase.rpc("public_org").maybeSingle(),
  ]);
  return (
    <SalesView
      moves={moves ?? []}
      products={products ?? []}
      currency={org?.currency ?? "CRC"}
      canEdit={staff.role === "admin" || staff.role === "shop"}
      from={from}
      to={to}
      today={today}
      capped={(moves?.length ?? 0) >= LEDGER_MAX}
    />
  );
}
