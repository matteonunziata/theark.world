import Link from "next/link";
import { initials } from "@/components/avatar";
import { avatarColor, type DirEntry } from "@/lib/connect";
import { coverUrl } from "@/lib/covers";
import { tierName } from "@/lib/crm";
import { dayLabel, fmtTime, pd } from "@/lib/dates";
import { kindName, type Offering } from "@/lib/schedule";

export function Av({ id, name, size }: { id: string; name: string; size?: "sm" }) {
  return (
    <span className={`pv-av ${size ?? ""}`} style={{ background: avatarColor(id) }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

/** A session (one date of a class, event, experience or expedition). */
export function SessionCard({
  o,
  date,
  today,
  cancelled,
  facilitator,
  price,
}: {
  o: Offering;
  date: string;
  today: string;
  cancelled?: boolean;
  facilitator?: string;
  price?: string;
}) {
  const cover = coverUrl(o.cover_path);
  const d = pd(date);
  return (
    <Link className={`pv-card ${cancelled ? "cancelled" : ""}`} href={`/e/${o.id}/${date}`}>
      <div
        className={`img k-${o.kind}`}
        style={cover ? { backgroundImage: `url(${cover})` } : undefined}
      >
        <span className="chip">{cancelled ? "Cancelled" : kindName(o.kind)}</span>
        <span className="date">
          {d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })}
          <b>{d.getUTCDate()}</b>
        </span>
      </div>
      <div className="body">
        <h3>{o.title}</h3>
        <span className="sub">
          {[dayLabel(date, today), fmtTime(o.start_time)].filter(Boolean).join(", ")}
          {o.location ? ` · ${o.location}` : ""}
        </span>
        <div className="foot">
          <span>{facilitator ? `with ${facilitator}` : ""}</span>
          <span>{price}</span>
        </div>
      </div>
    </Link>
  );
}

export function PersonCard({
  p,
  cityName,
  why,
  shared = [],
  canMessage,
}: {
  p: DirEntry;
  cityName?: string;
  why?: string;
  shared?: string[];
  canMessage: boolean;
}) {
  const sharedSet = new Set(shared.map((s) => s.toLowerCase()));
  return (
    <article className="pv-person">
      <div className="top">
        <Av id={p.id} name={p.name} />
        <div>
          <h3>{p.name}</h3>
          <div className="where">
            {[cityName, p.tier ? tierName(p.tier) : null].filter(Boolean).join(" · ")}
          </div>
        </div>
      </div>
      {why && <div className="why">{why}</div>}
      {p.bio && <p className="bio">{p.bio}</p>}
      {p.interests.length > 0 && (
        <div className="pv-tags">
          {p.interests.slice(0, 6).map((i) => (
            <span key={i} className={`pv-tag ${sharedSet.has(i.toLowerCase()) ? "match" : ""}`}>
              {i}
            </span>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: "auto", flexWrap: "wrap" }}>
        {canMessage && p.open_to_connect && !p.is_me && (
          <Link className="pv-btn sm" href={`/portal/messages/${p.id}`}>
            Say hello
          </Link>
        )}
        {p.instagram && (
          <a
            className="pv-btn ghost sm"
            href={`https://instagram.com/${p.instagram.replace("@", "")}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {p.instagram}
          </a>
        )}
      </div>
    </article>
  );
}

export function SectionHead({
  title,
  sub,
  href,
  link,
}: {
  title: string;
  sub?: string;
  href?: string;
  link?: string;
}) {
  return (
    <div className="pv-sec-h">
      <div>
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {href && <Link href={href}>{link ?? "See all"} →</Link>}
    </div>
  );
}
