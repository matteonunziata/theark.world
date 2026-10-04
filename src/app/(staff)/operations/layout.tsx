import { Tabs } from "@/components/tabs";
import { requireStaff } from "@/lib/auth";

export default async function OpsLayout({ children }: LayoutProps<"/operations">) {
  await requireStaff("operations");
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Operations</h1>
          <p className="lede">
            Everything the team needs to get done: tasks, maintenance,
            purchases, and event prep, moving through one pipeline.
          </p>
        </div>
      </div>
      <Tabs
        label="Operations sections"
        items={[
          { href: "/operations", label: "Pipeline" },
          { href: "/operations/list", label: "List" },
        ]}
      />
      {children}
    </div>
  );
}
