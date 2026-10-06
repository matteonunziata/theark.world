import Link from "next/link";
import { EventLink } from "./booking-modal";
import { initials } from "@/components/avatar";
import { avatarColor, type DirEntry } from "@/lib/connect";
import { avatarUrl, coverUrl } from "@/lib/covers";
import { firstName, tierName, waLink } from "@/lib/crm";
import { dayLabel, fmtTime, pd } from "@/lib/dates";
import { kindName, type Offering } from "@/lib/schedule";

export function Av({
  id,
  name,
  photo,
  size,
}: {
  id: string;
  name: string;
  photo?: string | null;
  size?: "sm";
}) {
  const src = avatarUrl(photo);
  return (
    <span
      className={`pv-av ${size ?? ""}`}
      style={{ background: avatarColor(id) }}
      aria-hidden="true"
      title={name}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt="" /> : initials(name)}
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
    <EventLink className={`pv-card ${cancelled ? "cancelled" : ""}`} id={o.id} date={date}>
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
    </EventLink>
  );
}

/** The WhatsApp link to a member who shares their number, with a hello to start from. */
export const whatsappHref = (p: Pick<DirEntry, "name" | "phone">, from?: string | null) =>
  waLink(
    p.phone,
    `Hi ${firstName(p.name)}, it’s ${from ? firstName(from) : "a fellow member"} from The ARK.`,
  );

export function PersonCard({
  p,
  why,
  shared = [],
  meName,
}: {
  p: DirEntry;
  why?: string;
  shared?: string[];
  /** The viewer's name, for the first line of the WhatsApp message. */
  meName?: string | null;
}) {
  const sharedSet = new Set(shared.map((s) => s.toLowerCase()));
  const wa = !p.is_me && p.open_to_connect ? whatsappHref(p, meName) : "";
  return (
    <article className="pv-person">
      <div className="top">
        <Av id={p.id} name={p.name} photo={p.photo_path} />
        <div>
          <h3>{p.name}</h3>
          <div className="where">
            {[p.cities.slice(0, 3).join(", "), p.tier ? tierName(p.tier) : null].filter(Boolean).join(" · ")}
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
        {wa && (
          <a className="pv-btn sm" href={wa} target="_blank" rel="noopener noreferrer">
            <WhatsAppIcon />
            Message on WhatsApp
          </a>
        )}
        {p.instagram && (
          <a
            className="pv-btn ghost sm"
            href={`https://instagram.com/${p.instagram.replace("@", "")}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {p.instagram.startsWith("@") ? p.instagram : `@${p.instagram}`}
          </a>
        )}
      </div>
    </article>
  );
}

export function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="currentColor">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 1.8a8.2 8.2 0 1 1-4.2 15.3l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 0 1 12 3.8zm-3.3 4.4c-.2 0-.5 0-.7.3-.3.3-1 1-1 2.3s1 2.7 1.1 2.9c.2.2 2 3.1 4.9 4.2 2.4.9 2.9.8 3.4.7.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3l-2-1c-.3-.1-.5-.2-.7.1l-1 1.2c-.2.2-.4.2-.6.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.8-1.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6z" />
    </svg>
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
