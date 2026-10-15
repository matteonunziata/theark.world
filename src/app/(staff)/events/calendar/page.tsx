import type { Metadata } from "next";
import { addDays, todayIn, weekStart } from "@/lib/dates";
import { listStripePrices, stripeReady } from "@/lib/stripe";
import { loadEvents } from "../data";
import { EventsView } from "../events-view";

export const metadata: Metadata = { title: "Schedule" };

// The staff calendar is reached at /admin-schedule (proxy rewrite), since /events is the public page on join.theark.world.
export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ week?: string | string[] }> }) {
  const { week } = await searchParams;
  const today = todayIn();
  const ws =
    typeof week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(week)
      ? weekStart(week)
      : weekStart(today);
  const data = await loadEvents(ws, addDays(ws, 6));
  const stripePrices = stripeReady() ? await listStripePrices().catch(() => []) : [];
  return <EventsView mode="week" weekStart={ws} today={today} stripePrices={stripePrices} {...data} />;
}
