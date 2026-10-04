import "server-only";
import { requireStaff } from "@/lib/auth";

export async function loadTasks() {
  const { supabase, staff } = await requireStaff("operations");
  const [tasks, team, divisions] = await Promise.all([
    supabase.from("tasks").select("*"),
    supabase.from("team_members").select("id, name, status").order("name"),
    supabase.from("divisions").select("id, name, color").order("name"),
  ]);
  return {
    staffId: staff.id,
    tasks: tasks.data ?? [],
    team: team.data ?? [],
    divisions: divisions.data ?? [],
  };
}
