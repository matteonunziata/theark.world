import type { Metadata } from "next";
import Link from "next/link";
import { LeafMark } from "@/components/leaf-mark";
import { requireStaff } from "@/lib/auth";
import { addDays, todayIn, weekStart } from "@/lib/dates";
import { canSee } from "@/lib/roles";
import { sessions } from "@/lib/schedule";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { supabase, staff } = await requireStaff("dashboard");
  const ws = weekStart(todayIn());
  const we = addDays(ws, 6);

  const [{ data: org }, { data: counts }, { data: offerings }, cancels, regs] =
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
  const isAdmin = staff.role === "admin";
  const named = org?.name && org.name !== "The ARK" ? org.name : null;

  const steps = [
    {
      done: !!named,
      t: "Add your organization details",
      s: "Name, location, currency, and time zone.",
      href: "/settings/organization",
      show: isAdmin,
    },
    {
      done: c.divisions > 0,
      t: "Set up divisions",
      s: "The groups your team works in, like Memberships or Operations.",
      href: "/settings/divisions",
      show: isAdmin,
    },
    {
      done: c.active_team > 1,
      t: "Add your team",
      s: "Who they are, what they do, and what they can access.",
      href: "/settings/team",
      show: isAdmin,
    },
    {
      done: c.offerings > 0,
      t: "Build the schedule",
      s: "Add your weekly classes and upcoming events.",
      href: "/events",
      show: canSee(staff.role, "events") && staff.role !== "sales",
    },
    {
      done: c.tasks > 0,
      t: "Start the operations pipeline",
      s: "Add the tasks the team is working on and assign them.",
      href: "/operations",
      show: true,
    },
  ].filter((s) => s.show);

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
        <LeafMark />
        <h1>{org?.name ?? "The ARK"}</h1>
        <p>One place to run the community, the club, the land, the farm, and the team.</p>
      </section>
      {steps.some((s) => !s.done) && (
        <>
          <h2 className="section-title">Get set up</h2>
          <div className="steps">
            {steps.map((s, i) => (
              <div className={`step ${s.done ? "done" : ""}`} key={s.href}>
                <div className="num">{s.done ? "✓" : i + 1}</div>
                <div className="txt">
                  <b>{s.t}</b>
                  <span>{s.done ? "Done" : s.s}</span>
                </div>
                <Link className="btn" href={s.href}>
                  {s.done ? "Edit" : "Open"}
                </Link>
              </div>
            ))}
          </div>
        </>
      )}
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
