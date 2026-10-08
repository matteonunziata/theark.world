import type { Metadata } from "next";
import { OfferingsList } from "../list-page";

export const metadata: Metadata = { title: "Events" };

export default function EventsListPage() {
  return <OfferingsList kinds={["event"]} />;
}
