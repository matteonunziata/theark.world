import type { Metadata } from "next";
import Link from "next/link";
import { todayIn } from "@/lib/dates";
import { lotTitle } from "@/lib/estate";
import { loadSteward } from "@/lib/steward-platform";
import { PropertyView } from "./property-view";
import { StewardSchedule } from "./steward-schedule";

export const metadata: Metadata = { title: "Steward platform" };

export default async function StewardHome({
  searchParams,
}: {
  searchParams: Promise<{ lot?: string; tab?: string }>;
}) {
  const p = await loadSteward();
  const { lot: want, tab } = await searchParams;
  const { data: lots } = await p.supabase.rpc("my_properties");
  const mine = lots ?? [];
  if (!mine.length) {
    return (
      <div className="pv-empty">
        <h3>No property linked yet</h3>
        <p>You’re an active steward, but no property is linked to you. Write to the team and they’ll set it up.</p>
      </div>
    );
  }
  const lot = mine.find((l) => l.id === want) ?? mine[0];
  const today = todayIn(p.timezone);
  const schedule = tab === "schedule";
  const [{ data: household }, { data: logs }, { data: stays }, { data: steward }, { data: services }] = await Promise.all([
    schedule ? Promise.resolve({ data: [] }) : p.supabase.from("lot_household").select("*").eq("lot_id", lot.id).order("created_at"),
    p.supabase.rpc("my_property_work", { p_lot: lot.id }),
    lot.in_hospitality ? p.supabase.rpc("my_property_stays", { p_lot: lot.id }) : Promise.resolve({ data: [] }),
    p.supabase.from("stewardships").select("status, active_since").eq("contact_id", p.stewardId).maybeSingle(),
    schedule ? p.supabase.rpc("my_property_services", { p_lot: lot.id }) : Promise.resolve({ data: [] }),
  ]);
  const q = (t: string) => `/steward?${new URLSearchParams({ lot: lot.id, ...(t === "schedule" ? { tab: "schedule" } : {}) })}`;
  return (
    <>
      {mine.length > 1 && (
        <div className="pv-pills">
          {mine.map((l) => (
            <Link key={l.id} className="pv-pill" href={`/steward?lot=${l.id}${schedule ? "&tab=schedule" : ""}`} aria-current={l.id === lot.id ? "page" : undefined}>
              {lotTitle(l)}
            </Link>
          ))}
        </div>
      )}
      <div className="pv-pills">
        <Link className="pv-pill" href={q("overview")} aria-current={!schedule ? "page" : undefined}>Overview</Link>
        <Link className="pv-pill" href={q("schedule")} aria-current={schedule ? "page" : undefined}>Schedule</Link>
      </div>
      {schedule ? (
        <StewardSchedule key={lot.id} lot={lot} stays={stays ?? []} work={logs ?? []} services={services ?? []} today={today} />
      ) : (
        <PropertyView
          key={lot.id}
          lot={lot}
          household={household ?? []}
          logs={logs ?? []}
          today={today}
          steward={steward ?? null}
        />
      )}
    </>
  );
}
