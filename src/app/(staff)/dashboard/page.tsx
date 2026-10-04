import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { requireStaff } from "@/lib/auth";
import { addDays, todayIn, weekStart } from "@/lib/dates";
import { sessions } from "@/lib/schedule";
import { TodoList } from "./todo-list";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { supabase, staff } = await requireStaff("dashboard");
  const today = todayIn();
  const ws = weekStart(today);
  const we = addDays(ws, 6);

  const [{ data: org }, { data: counts }, { data: offerings }, cancels, regs, { data: todos }] =
    await Promise.all([
      supabase.rpc("public_org").maybeSingle(),
      supabase.rpc("dashboard_counts").maybeSingle(),
      supabase.from("offerings").select("*"),
      supabase
        .from("session_cancellations")
        .select("offering_id, session_date")
        .gte("session_date", ws)
        .lte("session_date", we),
      supabase
        .from("registrations")
        .select("id", { count: "exact", head: true })
        .gte("session_date", ws)
        .lte("session_date", we),
      // Open to-dos plus anything finished today, so a tick doesn't vanish.
      supabase
        .from("tasks")
        .select("id, title, priority, due_date, status, location, completed_at")
        .eq("assignee_id", staff.id)
        .or(`status.neq.done,completed_at.gte.${today}`)
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(30),
    ]);

  const week = sessions(offerings ?? [], cancels.data ?? [], ws, we).filter(
    (s) => !s.cancelled,
  );
  const c = counts ?? {
    active_members: 0,
    active_team: 0,
    divisions: 0,
    offerings: 0,
    open_tasks: 0,
    overdue_tasks: 0,
    tasks: 0,
  };
  const stats: [number, string][] = [
    [c.active_members, "Active members"],
    [c.active_team, "Active team"],
    [week.length, "Sessions this week"],
    [regs.count ?? 0, "Bookings this week"],
    [c.open_tasks, "Open tasks"],
    [c.overdue_tasks, "Overdue"],
  ];

  return (
    <div className="page">
      <section className="hello">
        <Logo kind="mark" height={300} className="hello-mark" />
        <h1>{org?.name ?? "The ARK"}</h1>
        <p>One place to run the community, the club, the land, the farm, and the team.</p>
      </section>
      <TodoList todos={todos ?? []} today={today} />
      <h2 className="section-title">At a glance</h2>
      <div className="stats">
        {stats.map(([v, l]) => (
          <div className="stat" key={l}>
            <b>{v}</b>
            <span>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
