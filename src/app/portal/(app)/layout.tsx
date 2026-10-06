import { redirect } from "next/navigation";
import { ArkFonts } from "@/components/ark-fonts";
import { initials } from "@/components/avatar";
import { BookingModalProvider } from "../booking-modal";
import { ToastProvider } from "@/components/toast";
import { loadPortal } from "@/lib/portal";
import "../portal.css";
import { PortalShell } from "../portal-shell";

export default async function PortalLayout({ children }: LayoutProps<"/portal">) {
  const p = await loadPortal();
  // New members set up their profile first. Staff looking in are left alone.
  if (p.me && !p.me.onboarded_at && !p.staff) redirect("/portal/welcome");
  return (
    <ToastProvider>
      <ArkFonts />
      <div className="pv ark-type">
        <BookingModalProvider>
        <PortalShell
          initials={initials(p.me?.name ?? p.staff?.name ?? "")}
          isStaff={!!p.staff}
          isMember={!!p.memberId}
        >
          {children}
        </PortalShell>
        </BookingModalProvider>
      </div>
    </ToastProvider>
  );
}
