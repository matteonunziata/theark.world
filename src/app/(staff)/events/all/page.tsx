import type { Metadata } from "next";
import { todayIn } from "@/lib/dates";
import { loadEvents } from "../data";
import { EventsView } from "../events-view";

export const metadata: Metadata = { title: "All classes & events" };

export default async function AllOfferingsPage() {
  const today = todayIn();
  const data = await loadEvents(today, today);
  return <EventsView mode="all" weekStart={today} today={today} {...data} />;
}
