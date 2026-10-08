import type { Metadata } from "next";
import { todayIn } from "@/lib/dates";
import { listStripePrices, stripeReady } from "@/lib/stripe";
import { loadEvents } from "../data";
import { EventsView } from "../events-view";

export const metadata: Metadata = { title: "Events" };

export default async function EventsPage() {
  const today = todayIn();
  const data = await loadEvents(today, today);
  const stripePrices = stripeReady() ? await listStripePrices().catch(() => []) : [];
  return <EventsView mode="all" kinds={["event"]} weekStart={today} today={today} stripePrices={stripePrices} {...data} />;
}
