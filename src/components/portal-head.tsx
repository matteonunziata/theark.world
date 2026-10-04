import Link from "next/link";
import { Logo } from "@/components/logo";

export function PortalHead({
  sub,
  link,
}: {
  name?: string;
  sub: string;
  link?: { href: string; label: string };
}) {
  return (
    <header className="p-head">
      <div className="p-inner">
        <div>
          <Link href="/portal" aria-label="The ARK" className="p-brand">
            <Logo height={34} />
          </Link>
          <p>{sub}</p>
        </div>
        {link && <Link href={link.href}>{link.label}</Link>}
      </div>
    </header>
  );
}
