import type { Metadata } from "next";
import Link from "next/link";
import { todayIn } from "@/lib/dates";
import { lotTitle } from "@/lib/estate";
import { loadSteward } from "@/lib/steward-platform";
import { BillingTab, BudgetsTab, HospitalityTab, MaintenanceTab, NotesTab } from "./property-tabs";
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
  const tabs = [
    ["overview", "Overview"],
    ["schedule", "Schedule"],
    ["maintenance", "Maintenance"],
    ["budgets", "Budgets"],
    ["hospitality", "Hospitality"],
    ["billing", "Billing"],
    ["notes", "Notes"],
  ] as const;
  const current = tabs.find(([k]) => k === tab)?.[0] ?? "overview";
  const none = Promise.resolve({ data: [] as never[] });
  const sb = p.supabase;
  const [{ data: household }, { data: logs }, { data: stays }, { data: steward }, { data: services }, { data: detail }, { data: budgets }, { data: hosp }, { data: invoices }, { data: notes }] =
    await Promise.all([
      current === "overview" ? sb.from("lot_household").select("*").eq("lot_id", lot.id).order("created_at") : none,
      sb.rpc("my_property_work", { p_lot: lot.id }),
      lot.in_hospitality && (current === "schedule" || current === "overview") ? sb.rpc("my_property_stays", { p_lot: lot.id }) : none,
      sb.from("stewardships").select("status, active_since").eq("contact_id", p.stewardId).maybeSingle(),
      current === "schedule" ? sb.rpc("my_property_services", { p_lot: lot.id }) : none,
      sb.rpc("my_property_work_detail", { p_lot: lot.id }),
      sb.rpc("my_property_budgets", { p_lot: lot.id }),
      current === "hospitality" ? sb.rpc("my_property_hospitality", { p_lot: lot.id }) : none,
      current === "billing" ? sb.rpc("my_property_invoices", { p_lot: lot.id }) : none,
      current === "notes" ? sb.rpc("my_property_notes", { p_lot: lot.id }) : none,
    ]);
  const photoUrls: Record<string, string> = {};
  if (current === "maintenance") {
    const paths = (detail ?? []).flatMap((d) => ((d.photos as { path: string }[]) ?? []).map((x) => x.path));
    if (paths.length) {
      const { data } = await sb.storage.from("task-photos").createSignedUrls(paths, 3600);
      for (const r of data ?? []) if (r.path && r.signedUrl) photoUrls[r.path] = r.signedUrl;
    }
  }
  const q = (t: string) => `/steward?${new URLSearchParams({ lot: lot.id, ...(t === "overview" ? {} : { tab: t }) })}`;
  const charged = (logs ?? [])
    .filter((l) => l.status === "done")
    .reduce((a, l) => a + Number((detail ?? []).find((d) => d.task_id === l.id)?.charge ?? 0), 0);
  const nextStay = (stays ?? []).find((s) => s.kind === "guest" && s.status === "confirmed" && s.check_out >= today)?.check_in ?? null;
  return (
    <>
      {mine.length > 1 && (
        <div className="pv-pills">
          {mine.map((l) => (
            <Link key={l.id} className="pv-pill" href={`/steward?lot=${l.id}${current === "overview" ? "" : `&tab=${current}`}`} aria-current={l.id === lot.id ? "page" : undefined}>
              {lotTitle(l)}
            </Link>
          ))}
        </div>
      )}
      <div className="pv-pills">
        {tabs.map(([k, name]) => (
          <Link key={k} className="pv-pill" href={q(k)} aria-current={current === k ? "page" : undefined}>
            {name}
            {k === "budgets" && (budgets ?? []).some((b) => b.status === "pending") ? ` (${(budgets ?? []).filter((b) => b.status === "pending").length})` : ""}
          </Link>
        ))}
      </div>
      {current === "schedule" && (
        <StewardSchedule key={lot.id} lot={lot} stays={stays ?? []} work={logs ?? []} services={services ?? []} today={today} />
      )}
      {current === "overview" && (
        <PropertyView
          key={lot.id}
          lot={lot}
          household={household ?? []}
          logs={logs ?? []}
          today={today}
          steward={steward ?? null}
          stewardName={p.me?.name ?? null}
          pendingBudgets={(budgets ?? []).filter((b) => b.status === "pending").length}
          charged={charged}
          nextStay={nextStay}
        />
      )}
      {current === "maintenance" && <MaintenanceTab key={lot.id} lot={lot} logs={logs ?? []} detail={detail ?? []} photoUrls={photoUrls} />}
      {current === "budgets" && <BudgetsTab key={lot.id} budgets={budgets ?? []} />}
      {current === "hospitality" && <HospitalityTab key={lot.id} lot={lot} stays={hosp ?? []} />}
      {current === "billing" && <BillingTab key={lot.id} logs={logs ?? []} detail={detail ?? []} invoices={invoices ?? []} />}
      {current === "notes" && <NotesTab key={lot.id} lot={lot} notes={notes ?? []} />}
    </>
  );
}
