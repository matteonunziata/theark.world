import { Shell } from "@/components/shell";
import { ToastProvider } from "@/components/toast";
import { requireStaff } from "@/lib/auth";
import { modulesFor } from "@/lib/roles";

export default async function StaffLayout({
  children,
}: LayoutProps<"/">) {
  const { staff, supabase } = await requireStaff();
  const { data: org } = await supabase.rpc("public_org").maybeSingle();
  const nav = modulesFor(staff.role).map((m) => ({
    key: m.key,
    name: m.name,
    href: m.href,
    planned: !!m.planned,
  }));
  return (
    <ToastProvider>
      <Shell
        nav={nav}
        place={org?.location ?? "Santa Teresa, Costa Rica"}
        me={{ name: staff.name, role: staff.role }}
      >
        {children}
      </Shell>
    </ToastProvider>
  );
}
