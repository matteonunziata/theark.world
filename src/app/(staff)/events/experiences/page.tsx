import type { Metadata } from "next";
import { todayIn } from "@/lib/dates";
import { listStripePrices, stripeReady } from "@/lib/stripe";
import { loadEvents } from "../data";
import { EventsView } from "../events-view";

export const metadata: Metadata = { title: "Experiences" };

export default async function ExperiencesPage() {
  const today = todayIn();
  const data = await loadEvents(today, today);
  const stripePrices = stripeReady() ? await listStripePrices().catch(() => []) : [];
  return <EventsView mode="all" kinds={["experience", "expedition"]} weekStart={today} today={today} stripePrices={stripePrices} {...data} />;
}
