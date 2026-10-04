import type { Metadata } from "next";
import { requireSchool } from "@/lib/auth";
import { todayIn, weekStart } from "@/lib/dates";
import { TimetableView } from "./timetable-view";

export const metadata: Metadata = { title: "Arkadia timetable" };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export default async function TimetablePage({ searchParams }: PageProps<"/arkadia/schedule">) {
  const { week, group } = await searchParams;
  const { supabase } = await requireSchool();
  const today = todayIn();
  const from = weekStart(typeof week === "string" && ISO.test(week) ? week : today);
  const [{ data: entries }, { data: students }, { data: team }] = await Promise.all([
    supabase.from("school_schedule").select("*").order("start_time"),
    supabase.from("students").select("group_name").eq("status", "active"),
    supabase.from("team_members").select("id, name").eq("status", "active").order("name"),
  ]);
  const groups = [
    ...new Set([
      ...(students ?? []).map((s) => s.group_name),
      ...(entries ?? []).map((e) => e.group_name),
    ].filter(Boolean) as string[]),
  ].sort();
  return (
    <div className="page">
      <TimetableView
        entries={entries ?? []}
        groups={groups}
        team={team ?? []}
        from={from}
        today={today}
        group={typeof group === "string" ? group : ""}
      />
    </div>
  );
}
