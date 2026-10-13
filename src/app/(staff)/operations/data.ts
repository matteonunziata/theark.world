import "server-only";
import { requireStaff } from "@/lib/auth";
import { seesTaskMoney } from "@/lib/tasks";

export async function loadTasks() {
  const { supabase, staff } = await requireStaff("operations");
  const [tasks, team, divisions, lots, amenities] = await Promise.all([
    supabase.from("tasks").select("*"),
    supabase.from("team_members").select("id, name, status").order("name"),
    supabase.from("divisions").select("id, name, color").order("name"),
    supabase.from("lots").select("id, code, name").order("code"),
    supabase.from("amenities").select("id, name").eq("active", true).order("position"),
  ]);
  const money = seesTaskMoney(staff.role);
  return {
    staffId: staff.id,
    // Cost is for leads and admins; everyone else gets the task without it.
    tasks: (tasks.data ?? []).map((t) => (money ? t : { ...t, cost: null })),
    canSeeCost: money,
    team: team.data ?? [],
    divisions: divisions.data ?? [],
    lots: lots.data ?? [],
    amenities: amenities.data ?? [],
  };
}
