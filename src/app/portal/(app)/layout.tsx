import { redirect } from "next/navigation";
import { PortalHead } from "@/components/portal-head";
import { Tabs } from "@/components/tabs";
import { ToastProvider } from "@/components/toast";
import { getViewer } from "@/lib/auth";

export default async function PortalLayout({ children }: LayoutProps<"/portal">) {
  const { user, memberId, staff, supabase } = await getViewer();
  if (!user) redirect("/portal/login");
  if (!memberId && !staff) redirect("/no-access");
  const { data: org } = await supabase.rpc("public_org").maybeSingle();
  return (
    <ToastProvider>
      <PortalHead
        name={org?.name ?? "The ARK"}
        sub="Classes and events, updated live"
        link={staff ? { href: "/events", label: "Staff view" } : undefined}
      />
      <div className="p-body">
        <Tabs
          label="Portal sections"
          items={[
            { href: "/portal", label: "Schedule" },
            { href: "/portal/members", label: "Members" },
            { href: "/portal/bookings", label: "My bookings" },
          ]}
        />
        {children}
        {!staff && (
          <form action="/auth/signout?to=portal" method="post" style={{ marginTop: 32 }}>
            <button type="submit" className="btn ghost">
              Sign out
            </button>
          </form>
        )}
      </div>
    </ToastProvider>
  );
}
