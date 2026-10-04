import { Tabs } from "@/components/tabs";
import { requireStaff } from "@/lib/auth";

export default async function CrmLayout({ children }: LayoutProps<"/crm">) {
  await requireStaff("crm");
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>CRM</h1>
          <p className="lede">
            Every person The ARK knows, from a first conversation to a steward
            on the land.
          </p>
        </div>
      </div>
      <Tabs
        label="CRM sections"
        items={[
          { href: "/crm/people", label: "People" },
          { href: "/crm/pipelines", label: "Pipelines" },
          { href: "/crm/sequences", label: "Sequences" },
          { href: "/crm/queue", label: "Send queue" },
        ]}
      />
      {children}
    </div>
  );
}
