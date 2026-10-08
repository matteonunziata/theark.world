import type { Metadata } from "next";
import Link from "next/link";
import { ArkFonts } from "@/components/ark-fonts";
import { Logo } from "@/components/logo";
import { getViewer } from "@/lib/auth";
import { coverUrl } from "@/lib/covers";
import { addDays, fmtDate, timeRange, todayIn } from "@/lib/dates";
import { kindName, priceLabel, sessions } from "@/lib/schedule";
import { HostForm } from "./host-form";
import { type EventRow, EventsList } from "./events-list";
import "./events.css";

export const metadata: Metadata = {
  title: { absolute: "Events — The ARK, Santa Teresa" },
  description:
    "Markets, music, farm-to-table dinners and summits at The ARK in Santa Teresa. Open to the village, with members first in line.",
};

const MEMBERSHIP = "/ark-membership";

export default async function EventsPage() {
  const { supabase, memberId, staff } = await getViewer();
  const { data: org } = await supabase.rpc("public_org").maybeSingle();
  const today = todayIn(org?.timezone);
  const to = addDays(today, 365);

  const [{ data: offerings }, { data: cancels }] = await Promise.all([
    supabase.from("offerings").select("*").eq("status", "published").neq("kind", "class"),
    supabase.from("session_cancellations").select("offering_id, session_date").gte("session_date", today),
  ]);
  const ids = (offerings ?? []).map((o) => o.id);
  const { data: tickets } = ids.length
    ? await supabase.from("ticket_types").select("*").in("offering_id", ids)
    : { data: [] };

  const upcoming = sessions(offerings ?? [], cancels ?? [], today, to).filter((s) => !s.cancelled);
  // A weekly event would fill the list with copies; show each one's next date.
  const seen = new Set<string>();
  const next = upcoming.filter((s) => (seen.has(s.o.id) ? false : (seen.add(s.o.id), true)));

  const rows: EventRow[] = next.map((s) => ({
    key: `${s.o.id}|${s.date}`,
    id: s.o.id,
    date: s.date,
    month: fmtDate(s.date, { month: "short" }),
    day: fmtDate(s.date, { day: "numeric" }),
    year: s.date.slice(0, 4),
    kind: kindName(s.o.kind),
    when: [fmtDate(s.date, { weekday: "long" }), timeRange(s.o)].filter(Boolean).join(" · "),
    title: s.o.title,
    desc: s.o.description ?? "",
    price: priceLabel(s.o, tickets ?? []),
    cta: s.o.access === "members" && !memberId ? "Members only" : "Details",
  }));

  const featured = next.find((s) => s.o.cover_path) ?? next[0];
  const cover = featured ? coverUrl(featured.o.cover_path) : null;

  return (
    <main className="evp">
      <ArkFonts />
      <header>
        <nav aria-label="Main">
          <Link href="/whats-on" aria-label="The ARK events">
            <Logo tone="dark" height={40} />
          </Link>
          <div className="nav-links">
            <a href="#upcoming">Upcoming</a>
            <a href="#host">Host an event</a>
            <Link href={MEMBERSHIP}>Membership</Link>
          </div>
          <div className="nav-right">
            {staff ? (
              <Link href="/events/events" className="btn btn-primary sm">Staff view</Link>
            ) : memberId ? (
              <Link href="/portal/schedule" className="btn btn-primary sm">Sign in</Link>
            ) : (
              <>
                <Link className="nav-login" href="/portal/login?next=/whats-on">Sign in</Link>
                <a className="btn btn-primary sm" href="#upcoming">See what’s on</a>
              </>
            )}
          </div>
        </nav>
      </header>

      <section className="hero dark">
        <div className="wrap">
          <div className="hero-copy">
            <p className="eyebrow">The ARK · Santa Teresa</p>
            <h1>Events at The ARK</h1>
            <p className="hero-sub">
              Markets, music, farm-to-table dinners and summits — open to the village, with members first in line.
            </p>
            <div className="btn-row">
              <a className="btn btn-accent" href="#upcoming">See upcoming events</a>
              <a className="btn btn-ghost-light" href="#host">Host at The ARK</a>
            </div>
          </div>

          {featured && (
            <article className="featured">
              <div
                className="featured-img"
                role={cover ? "img" : undefined}
                aria-label={cover ? featured.o.title : undefined}
                style={cover ? { backgroundImage: `url(${cover})` } : undefined}
              />
              <div className="featured-body">
                <span className="tag tag-dark">Next up · {kindName(featured.o.kind)}</span>
                <h2>{featured.o.title}</h2>
                {featured.o.description && <p>{featured.o.description}</p>}
                <dl className="facts">
                  <dt>When</dt>
                  <dd>
                    {fmtDate(featured.date, { weekday: "long", month: "long", day: "numeric" })}
                    {featured.o.start_time ? ` · ${timeRange(featured.o)}` : ""}
                  </dd>
                  <dt>Where</dt>
                  <dd>{featured.o.location || "The ARK, Santa Teresa"}</dd>
                  <dt>Entry</dt>
                  <dd>{priceLabel(featured.o, tickets ?? [])}</dd>
                </dl>
                <div className="btn-row" style={{ marginTop: 8 }}>
                  <Link className="btn btn-primary" href={`/e/${featured.o.id}/${featured.date}`}>
                    {featured.o.access === "members" && !memberId ? "See details" : "Get tickets"}
                  </Link>
                </div>
              </div>
            </article>
          )}
        </div>
      </section>

      <section id="upcoming" className="upcoming">
        <div className="wrap">
          <div className="section-head">
            <div>
              <p className="eyebrow">Upcoming</p>
              <h2>The season ahead.</h2>
            </div>
          </div>
          <EventsList events={rows} />
        </div>
      </section>

      <section className="band-section">
        <div className="wrap members-band dark">
          <div>
            <h3>Members are first in.</h3>
            <p>Early access to every event, 10% off tickets — 20% on Annual.</p>
          </div>
          <div className="btn-row">
            <Link className="btn btn-accent" href={`${MEMBERSHIP}/apply`}>Apply for membership</Link>
            {!memberId && <Link className="btn btn-ghost-light" href="/portal/login?next=/whats-on">Sign in</Link>}
          </div>
        </div>
      </section>

      <section id="host" className="host">
        <div className="wrap">
          <div className="host-copy">
            <p className="eyebrow">Host an event</p>
            <h2>Bring your people here.</h2>
            <p>
              Retreats, workshops, dinners and celebrations — across the ARK House, the Shala, the Space Deck and the
              Courts.
            </p>
          </div>
          <HostForm />
        </div>
      </section>

      <footer className="dark">
        <div className="wrap">
          <span className="brand">
            <Logo tone="light" kind="mark" height={32} /> Santa Teresa, Costa Rica
          </span>
          <div className="links">
            <Link href={MEMBERSHIP}>Membership</Link>
            <Link href="/courts">Courts</Link>
            <Link href="/portal/login?next=/whats-on">Sign in</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
