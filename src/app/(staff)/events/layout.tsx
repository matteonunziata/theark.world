import { Tabs } from "@/components/tabs";
import { requireStaff } from "@/lib/auth";

export default async function EventsLayout({ children }: LayoutProps<"/events">) {
  await requireStaff("events");
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Events &amp; classes</h1>
          <p className="lede">
            Build the schedule, assign facilitators, and set up tickets.
            Published sessions appear on the members portal as soon as you save.
          </p>
        </div>
      </div>
      <Tabs
        label="Events sections"
        items={[
          { href: "/events", label: "Schedule" },
          { href: "/events/all", label: "All classes & events" },
        ]}
      />
      {children}
    </div>
  );
}
