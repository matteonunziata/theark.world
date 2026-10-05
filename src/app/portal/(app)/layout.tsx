import { ArkFonts } from "@/components/ark-fonts";
import { initials } from "@/components/avatar";
import { BookingModalProvider } from "../booking-modal";
import { ToastProvider } from "@/components/toast";
import { loadPortal } from "@/lib/portal";
import "../portal.css";
import { PortalShell } from "../portal-shell";

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
      <ArkFonts />
      <div className="pv ark-type">
        <BookingModalProvider>
        <PortalShell
          cities={p.cities.map((c) => ({ id: c.id, name: c.name }))}
          cityId={p.city?.id ?? null}
          initials={initials(p.me?.name ?? p.staff?.name ?? "")}
          unread={count ?? 0}
          isStaff={!!p.staff}
        >
          {children}
        </PortalShell>
        </BookingModalProvider>
      </div>
    </ToastProvider>
  );
}
