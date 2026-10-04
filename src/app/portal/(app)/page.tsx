import type { Metadata } from "next";
import { getViewer } from "@/lib/auth";
import { addDays, todayIn } from "@/lib/dates";
import { sessions } from "@/lib/schedule";
import { ScheduleList } from "./schedule-list";

export const metadata: Metadata = { title: "Members portal" };

export default async function PortalSchedule() {
  const { supabase } = await getViewer();
  const today = todayIn();
  const to = addDays(today, 20);
  const [{ data: offerings }, { data: tickets }, { data: cancels }, { data: facs }] =
    await Promise.all([
      supabase.from("offerings").select("*").eq("status", "published"),
      supabase.from("ticket_types").select("*"),
      supabase
        .from("session_cancellations")
        .select("offering_id, session_date")
        .gte("session_date", today),
      supabase.rpc("facilitator_names"),
    ]);
  const list = sessions(offerings ?? [], cancels ?? [], today, to, { published: true });
  return (
    <ScheduleList
      today={today}
      sessions={list}
      tickets={tickets ?? []}
      facilitators={facs ?? []}
    />
  );
}
