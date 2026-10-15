import { Tabs } from "@/components/tabs";

/** The two views under the Events tab: the list to edit, and the per-event numbers and attendees. */
export function EventSubTabs() {
  return (
    <Tabs
      label="Events views"
      items={[
        { href: "/events/events", label: "All events" },
        { href: "/events/event-analytics", label: "Analytics" },
      ]}
    />
  );
}
