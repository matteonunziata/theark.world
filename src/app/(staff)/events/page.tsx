import type { Metadata } from "next";
import { addDays, todayIn, weekStart } from "@/lib/dates";
import { loadEvents } from "./data";
import { EventsView } from "./events-view";

export const metadata: Metadata = { title: "Schedule" };

export default async function SchedulePage({ searchParams }: PageProps<"/events">) {
  const { week } = await searchParams;
  const today = todayIn();
  const ws =
    typeof week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(week)
      ? weekStart(week)
      : weekStart(today);
  const data = await loadEvents(ws, addDays(ws, 6));
  return <EventsView mode="week" weekStart={ws} today={today} {...data} />;
}
