import type { Metadata } from "next";
import Link from "next/link";
import { requireSchool } from "@/lib/auth";
import { addDays, todayIn, weekStart } from "@/lib/dates";
import { CalendarTab } from "./calendar-tab";
import { CurriculumTab } from "./curriculum-tab";
import { HomeworkTab } from "./homework-tab";
import { StudentsView } from "./students-view";

export const metadata: Metadata = { title: "Arkadia" };

const TABS = [
  ["students", "Students"],
  ["calendar", "Calendar"],
  ["curriculum", "Curriculum"],
  ["homework", "Homework"],
] as const;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export default async function ArkadiaPage({ searchParams }: PageProps<"/arkadia">) {
  const { tab: rawTab, week } = await searchParams;
  const tab = TABS.find(([k]) => k === rawTab)?.[0] ?? "students";
  const { supabase } = await requireSchool();
  const today = todayIn();
  const from = weekStart(typeof week === "string" && ISO.test(week) ? week : today);

  const [{ data: students }, { data: updates }, { data: entries }, { data: team }, { data: curriculum }, { data: homework }] =
    await Promise.all([
      supabase.from("students").select("*").order("name"),
      supabase
        .from("student_updates")
        .select("student_id, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("school_schedule").select("*").order("start_time"),
      supabase.from("team_members").select("id, name").eq("status", "active").order("name"),
      supabase.from("school_curriculum").select("*").order("week_no"),
      supabase.from("school_homework").select("*").order("due_on", { ascending: false, nullsFirst: false }),
    ]);

  const last = new Map<string, string>();
  for (const u of updates ?? []) if (!last.has(u.student_id)) last.set(u.student_id, u.created_at);
  const groups = [
    ...new Set(
      [
        ...(students ?? []).map((s) => s.group_name),
        ...(entries ?? []).map((e) => e.group_name),
        ...(curriculum ?? []).map((c) => c.group_name),
        ...(homework ?? []).map((h) => h.group_name),
      ].filter(Boolean) as string[],
    ),
  ].sort();
  const thisWeek = weekStart(today);
  const now = (curriculum ?? []).find((c) => c.starts_on === thisWeek && !c.group_name) ?? (curriculum ?? []).find((c) => c.starts_on === thisWeek);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Arkadia</h1>
          <p className="lede">
            The school at The ARK. Every student, the week ahead, what we’re
            teaching and what’s going home.
          </p>
        </div>
        {now && (
          <div className="week-now">
            <span>This week</span>
            <b>Week {now.week_no} · {now.title}</b>
          </div>
        )}
      </div>
      <nav className="school-tabs" aria-label="Arkadia">
        {TABS.map(([k, label]) => (
          <Link key={k} href={k === "students" ? "/arkadia" : `/arkadia?tab=${k}`} className={tab === k ? "on" : ""} aria-current={tab === k ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </nav>

      {tab === "students" && (
        <StudentsView
          students={(students ?? []).map((s) => ({ ...s, last_update: last.get(s.id) ?? null }))}
          today={today}
        />
      )}
      {tab === "calendar" && (
        <CalendarTab
          entries={entries ?? []}
          team={team ?? []}
          students={students ?? []}
          from={from}
          prev={addDays(from, -7)}
          next={addDays(from, 7)}
          today={today}
        />
      )}
      {tab === "curriculum" && (
        <CurriculumTab weeks={curriculum ?? []} groups={groups} thisWeek={thisWeek} />
      )}
      {tab === "homework" && <HomeworkTab items={homework ?? []} groups={groups} today={today} />}
    </div>
  );
}
