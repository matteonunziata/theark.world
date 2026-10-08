import { todayIn } from "@/lib/dates";
import type { Kind } from "@/lib/schedule";
import { listStripePrices, stripeReady } from "@/lib/stripe";
import { loadEvents } from "./data";
import { EventsView } from "./events-view";

/** A Schedule tab that lists one kind of offering (classes, events, experiences). */
export async function OfferingsList({ kinds }: { kinds: Kind[] }) {
  const today = todayIn();
  const data = await loadEvents(today, today);
  const stripePrices = stripeReady() ? await listStripePrices().catch(() => []) : [];
  return <EventsView mode="all" kinds={kinds} weekStart={today} today={today} stripePrices={stripePrices} {...data} />;
}
