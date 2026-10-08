import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { ScheduleView } from "../schedule-view";

export const metadata: Metadata = { title: "Maintenance" };

export default async function MaintenancePage() {
  const { supabase } = await requireStaff("operations");
  const [{ data: tasks }, { data: staff }] = await Promise.all([
    supabase.from("cleaning_tasks").select("*").eq("kind", "maintenance").order("start_time", { nullsFirst: false }).order("position"),
    supabase.from("cleaning_staff").select("*").eq("kind", "maintenance").order("created_at").order("name"),
  ]);
  return <ScheduleView kind="maintenance" tasks={tasks ?? []} staff={staff ?? []} today={todayIn()} />;
}
