import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { todayIn } from "@/lib/dates";
import { loadPortal } from "@/lib/portal";
import { lotTitle } from "@/lib/estate";
import { PropertyView } from "./property-view";

export const metadata: Metadata = { title: "My Property" };

export default async function PropertyPage({ searchParams }: { searchParams: Promise<{ lot?: string }> }) {
  const p = await loadPortal();
  if (!p.memberId) redirect("/portal");
  const { data: lots } = await p.supabase.rpc("my_properties");
  const mine = lots ?? [];
  if (!mine.length) redirect("/portal");
  const { lot: want } = await searchParams;
  const lot = mine.find((l) => l.id === want) ?? mine[0];
  const [{ data: household }, { data: logs }, { data: stays }, { data: steward }] = await Promise.all([
    p.supabase.from("lot_household").select("*").eq("lot_id", lot.id).order("created_at"),
    p.supabase.from("lot_maintenance").select("*").eq("lot_id", lot.id).order("performed_on", { ascending: false }),
    lot.in_hospitality ? p.supabase.rpc("my_property_stays", { p_lot: lot.id }) : Promise.resolve({ data: [] }),
    p.supabase.from("stewardships").select("status, active_since").eq("contact_id", p.memberId).maybeSingle(),
  ]);
  return (
    <>
      {mine.length > 1 && (
        <div className="pv-pills">
          {mine.map((l) => (
            <Link key={l.id} className="pv-pill" href={`/portal/property?lot=${l.id}`} aria-current={l.id === lot.id ? "page" : undefined}>
              {lotTitle(l)}
            </Link>
          ))}
        </div>
      )}
      <PropertyView
        key={lot.id}
        lot={lot}
        household={household ?? []}
        logs={logs ?? []}
        stays={stays ?? []}
        today={todayIn(p.timezone)}
        steward={steward ?? null}
      />
    </>
  );
}
