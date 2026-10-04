import { Fraunces } from "next/font/google";
import { initials } from "@/components/avatar";
import { ToastProvider } from "@/components/toast";
import { loadPortal } from "@/lib/portal";
import "../portal.css";
import { PortalShell } from "../portal-shell";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["500", "600"],
});

export default async function PortalLayout({ children }: LayoutProps<"/portal">) {
  const p = await loadPortal();
  const { count } = p.memberId
    ? await p.supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", p.memberId)
        .is("read_at", null)
    : { count: 0 };
  return (
    <ToastProvider>
      <div className={`pv ${fraunces.variable}`}>
        <PortalShell
          cities={p.cities.map((c) => ({ id: c.id, name: c.name }))}
          cityId={p.city?.id ?? null}
          initials={initials(p.me?.name ?? p.staff?.name ?? "")}
          unread={count ?? 0}
          isStaff={!!p.staff}
        >
          {children}
        </PortalShell>
      </div>
    </ToastProvider>
  );
}
