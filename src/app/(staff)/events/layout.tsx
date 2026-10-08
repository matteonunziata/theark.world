import { Tabs } from "@/components/tabs";
import { requireStaff } from "@/lib/auth";

export default async function EventsLayout({ children }: LayoutProps<"/events">) {
  await requireStaff("events");
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Schedule</h1>
          <p className="lede">
            Classes, events, experiences and the courts. Published sessions appear on the
            members portal as soon as you save.
          </p>
        </div>
      </div>
      <Tabs
        label="Events sections"
        items={[
          { href: "/events", label: "Calendar" },
          { href: "/events/classes", label: "Classes" },
          { href: "/events/events", label: "Events" },
          { href: "/events/courts", label: "Courts" },
          { href: "/events/experiences", label: "Experiences" },
          { href: "/events/analytics", label: "Analytics" },
        ]}
      />
      {children}
    </div>
  );
}
