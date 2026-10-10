import Link from "next/link";
import { ArkFonts } from "@/components/ark-fonts";
import { initials } from "@/components/avatar";
import { Logo } from "@/components/logo";
import { ToastProvider } from "@/components/toast";
import { loadSteward } from "@/lib/steward-platform";
import "../../portal/portal.css";

export default async function StewardLayout({ children }: { children: React.ReactNode }) {
  const s = await loadSteward();
  return (
    <ToastProvider>
      <ArkFonts />
      <div className="pv ark-type">
        <header className="pv-top">
          <div className="pv-top-in">
            <Link href="/steward" className="pv-logo" aria-label="The ARK steward platform">
              <Logo tone="dark" height={26} />
            </Link>
            <span className="pv-nav" style={{ color: "var(--pv-muted)", fontWeight: 600 }}>Steward platform</span>
            <div className="pv-top-r">
              {s.memberId && (
                <Link className="pv-btn ghost sm" href="/portal">Members portal</Link>
              )}
              {s.staff && (
                <Link className="pv-btn ghost sm" href="/">Team portal</Link>
              )}
              <span className="pv-me" title={s.me?.name ?? ""}>{initials(s.me?.name ?? "")}</span>
              <form action="/auth/signout" method="post">
                <button type="submit" className="pv-btn ghost sm">Sign out</button>
              </form>
            </div>
          </div>
        </header>
        <main className="pv-main">{children}</main>
      </div>
    </ToastProvider>
  );
}
