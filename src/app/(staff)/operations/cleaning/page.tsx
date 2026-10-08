import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { ScheduleView } from "../schedule-view";

export const metadata: Metadata = { title: "Cleaning" };

export default async function CleaningPage() {
  const { supabase } = await requireStaff("operations");
  const [{ data: tasks }, { data: staff }] = await Promise.all([
    supabase.from("cleaning_tasks").select("*").eq("kind", "cleaning").order("start_time", { nullsFirst: false }).order("position"),
    supabase.from("cleaning_staff").select("*").eq("kind", "cleaning").order("created_at").order("name"),
  ]);
  return <ScheduleView kind="cleaning" tasks={tasks ?? []} staff={staff ?? []} today={todayIn()} />;
}
