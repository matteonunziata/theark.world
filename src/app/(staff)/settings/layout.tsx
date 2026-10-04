import { Tabs } from "@/components/tabs";
import { requireStaff } from "@/lib/auth";

export default async function SettingsLayout({
  children,
}: LayoutProps<"/settings">) {
  await requireStaff("settings");
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="lede">
            Who’s on the team, how The ARK is organized, and what each person
            can see.
          </p>
        </div>
      </div>
      <Tabs
        label="Settings sections"
        items={[
          { href: "/settings/team", label: "Team" },
          { href: "/settings/divisions", label: "Divisions" },
          { href: "/settings/cities", label: "Cities" },
          { href: "/settings/access", label: "Access levels" },
          { href: "/settings/organization", label: "Organization" },
        ]}
      />
      {children}
    </div>
  );
}
