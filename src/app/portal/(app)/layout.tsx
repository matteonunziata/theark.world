import { redirect } from "next/navigation";
import { ArkFonts } from "@/components/ark-fonts";
import { initials } from "@/components/avatar";
import { BookingModalProvider } from "../booking-modal";
import { ToastProvider } from "@/components/toast";
import { loadPortal } from "@/lib/portal";
import "../portal.css";
import { LapsedPass } from "../lapsed-pass";
import { PortalShell } from "../portal-shell";

export default async function PortalLayout({ children }: LayoutProps<"/portal">) {
  const p = await loadPortal();
  // New members set up their profile first, and security needs a photo to let
  // anyone in, so nobody gets past this without one. Staff looking in are left alone.
  if (p.me && !p.lapsed && !p.staff && (!p.me.onboarded_at || !p.me.photo_path)) redirect("/portal/welcome");
  return (
    <ToastProvider>
      <ArkFonts />
      <div className="pv ark-type">
        <BookingModalProvider>
        <PortalShell
          initials={initials(p.me?.name ?? p.staff?.name ?? "")}
          isStaff={!!p.staff}
          isMember={!!p.memberId}
          hasProperty={!!p.memberId && !!p.stewardId}
        >
          {p.lapsed ? <LapsedPass last={p.lastPass} name={p.me?.name ?? ""} /> : children}
        </PortalShell>
        </BookingModalProvider>
      </div>
    </ToastProvider>
  );
}
