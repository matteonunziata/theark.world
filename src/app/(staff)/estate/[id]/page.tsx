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

export default async function LotPage({ params }: Props) {
  const { id } = await params;
  const { supabase } = await requireStaff("estate");
  const today = todayIn();
  const [{ data: lot }, { data: household }, { data: logs }, { data: stays }, { data: people }, { data: team }, { data: lots }] =
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
    ]);
  if (!lot) notFound();
  const owner = (people ?? []).find((p) => p.id === lot.owner_contact_id) ?? null;
  return (
    <div className="page">
      <LotView
        lot={lot}
        owner={owner}
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
