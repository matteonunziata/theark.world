import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { lotTitle } from "@/lib/estate";
import { LotView } from "./lot-view";

type Props = PageProps<"/estate/[id]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const { supabase } = await requireStaff("estate");
  const { data } = await supabase.from("lots").select("code, name").eq("id", id).maybeSingle();
  return { title: data ? lotTitle(data) : "Lot" };
}

export default async function LotPage({ params, searchParams }: Props & { searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab } = await searchParams;
  const { supabase } = await requireStaff("estate");
  const today = todayIn();
  const [{ data: lot }, { data: household }, { data: logs }, { data: stays }, { data: people }, { data: team }, { data: lots }, { data: links }] =
    await Promise.all([
      supabase.from("lots").select("*").eq("id", id).maybeSingle(),
      supabase.from("lot_household").select("*").eq("lot_id", id).order("created_at"),
      supabase.from("lot_maintenance").select("*").eq("lot_id", id).order("performed_on", { ascending: false }),
      supabase
        .from("stays")
        .select("*")
        .eq("lot_id", id)
        .gte("check_out", today)
        .neq("status", "cancelled")
        .order("check_in"),
      supabase.from("contacts").select("id, name, email, phone").order("name"),
      supabase.from("team_members").select("id, name"),
      supabase.from("lots").select("id, code, name, estate_lot_id"),
      supabase.from("property_stewards").select("contact_id, created_at").eq("lot_id", id).order("created_at"),
    ]);
  if (!lot) notFound();
  const stewards = (links ?? [])
    .map((l) => (people ?? []).find((p) => p.id === l.contact_id))
    .filter((p): p is NonNullable<typeof p> => !!p);
  return (
    <div className="page">
      <LotView
        lot={lot}
        stewards={stewards}
        tab={["financials", "schedule", "maintenance"].includes(tab ?? "") ? tab! : "overview"}
        household={household ?? []}
        logs={(logs ?? []).map((l) => ({
          ...l,
          logged_by: team?.find((t) => t.id === l.created_by)?.name ?? null,
        }))}
        stays={stays ?? []}
        people={(people ?? []).map((p) => ({ id: p.id, name: p.name }))}
        lots={lots ?? []}
        today={today}
      />
    </div>
  );
}
