import Link from "next/link";
import type { Convo } from "./messages-data";
import { Av } from "./ui";

export function ConvoList({ convos, current }: { convos: Convo[]; current?: string }) {
  return (
    <nav className="pv-convos" aria-label="Conversations">
      {convos.map((c) => (
        <Link key={c.id} href={`/portal/messages/${c.id}`} aria-current={c.id === current ? "page" : undefined}>
          <Av id={c.id} name={c.name} size="sm" />
          <span style={{ minWidth: 0 }}>
            <b style={{ display: "block" }}>{c.name}</b>
            <span className="snip">{c.last}</span>
          </span>
          {c.unread > 0 && <span className="unread" aria-label={`${c.unread} unread`} />}
        </Link>
      ))}
    </nav>
  );
}
