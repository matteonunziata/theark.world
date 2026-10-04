import { Shell } from "@/components/shell";
import { ToastProvider } from "@/components/toast";
import { requireStaff } from "@/lib/auth";
import { MODULES, modulesFor } from "@/lib/roles";

export default async function StaffLayout({
  children,
}: LayoutProps<"/">) {
  const { staff, supabase } = await requireStaff();
  const [{ data: org }, { data: school }] = await Promise.all([
    supabase.rpc("public_org").maybeSingle(),
    supabase.rpc("is_school_staff"),
  ]);
  const mods = modulesFor(staff.role);
  if (school && !mods.some((m) => m.key === "school")) {
    const at = mods.findIndex((m) => m.key === "operations");
    mods.splice(at < 0 ? mods.length : at, 0, MODULES.find((m) => m.key === "school")!);
  }
  const nav = mods.map((m) => ({
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
