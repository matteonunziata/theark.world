import Link from "next/link";

export function PortalHead({
  name,
  sub,
  link,
}: {
  name: string;
  sub: string;
  link?: { href: string; label: string };
}) {
  return (
    <header className="p-head">
      <div className="p-inner">
        <div>
          <h1>{name}</h1>
          <p>{sub}</p>
        </div>
        {link && <Link href={link.href}>{link.label}</Link>}
      </div>
    </header>
  );
}
