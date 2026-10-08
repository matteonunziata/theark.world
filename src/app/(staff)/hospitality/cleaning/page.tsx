import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { HospitalityHead } from "../hospitality-head";
import { CleaningView } from "./cleaning-view";

export const metadata: Metadata = { title: "Cleaning" };

export default async function CleaningPage() {
  const { supabase } = await requireStaff("hospitality");
  const [{ data: tasks }, { data: staff }] = await Promise.all([
    supabase.from("cleaning_tasks").select("*").order("start_time", { nullsFirst: false }).order("position"),
    supabase.from("cleaning_staff").select("*").order("created_at").order("name"),
  ]);
  return (
    <div className="page">
      <HospitalityHead />
      <CleaningView tasks={tasks ?? []} staff={staff ?? []} today={todayIn()} />
    </div>
  );
}
