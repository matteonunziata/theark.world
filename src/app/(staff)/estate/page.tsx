import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { EstateHead } from "./estate-head";
import { LotsView } from "./lots-view";

export const metadata: Metadata = { title: "Real estate" };

export default async function EstatePage() {
  const { supabase } = await requireStaff("estate");
  const [{ data: lots }, { data: people }, { data: household }] = await Promise.all([
    supabase.from("lots").select("*").order("code"),
    supabase.from("contacts").select("id, name").order("name"),
    supabase.from("lot_household").select("lot_id"),
  ]);
  const owners = new Map((people ?? []).map((p) => [p.id, p.name]));
  const counts = new Map<string, number>();
  for (const h of household ?? []) counts.set(h.lot_id, (counts.get(h.lot_id) ?? 0) + 1);
  return (
    <div className="page">
      <EstateHead />
      <LotsView
        lots={(lots ?? []).map((l) => ({
          ...l,
          owner: l.owner_contact_id ? (owners.get(l.owner_contact_id) ?? null) : null,
          household: counts.get(l.id) ?? 0,
        }))}
        people={people ?? []}
      />
    </div>
  );
}
