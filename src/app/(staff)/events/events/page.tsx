import type { Metadata } from "next";
import { EventSubTabs } from "../event-subtabs";
import { OfferingsList } from "../list-page";

export const metadata: Metadata = { title: "Events" };

export default function EventsListPage() {
  return (
    <>
      <EventSubTabs />
      <OfferingsList kinds={["event"]} />
    </>
  );
}
