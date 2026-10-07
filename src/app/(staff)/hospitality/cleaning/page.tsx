import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { HospitalityHead } from "../hospitality-head";
import { CleaningView } from "./cleaning-view";

export const metadata: Metadata = { title: "Cleaning" };

export default async function CleaningPage() {
  const { supabase } = await requireStaff("hospitality");
  const { data } = await supabase
    .from("cleaning_tasks")
    .select("*")
    .order("area")
    .order("position")
    .order("created_at");
  return (
    <div className="page">
      <HospitalityHead />
      <CleaningView tasks={data ?? []} today={todayIn()} />
    </div>
  );
}
