import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArkFonts } from "@/components/ark-fonts";
import { Logo } from "@/components/logo";
import { getViewer } from "@/lib/auth";
import { BOOKING_DAYS, courtMoney, HOLD_MINUTES, LEVELS, levelRange, type PublicCourt, sportName } from "@/lib/courts";
import { addDays, fmtDate, fmtTime, todayIn } from "@/lib/dates";
import { stripeReady } from "@/lib/stripe";
import { CourtBooker, type DayRow, type Me } from "./court-booker";
import "./courts.css";

export const metadata: Metadata = {
  title: { absolute: "Book a court — The ARK, Santa Teresa" },
  description:
    "Two padel courts and a pickleball court in Santa Teresa, Costa Rica. See what’s free, book and pay online.",
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export default async function CourtsPage({ searchParams }: PageProps<"/courts">) {
  const sp = await searchParams;
  const { supabase, memberId, staff } = await getViewer();
  const [{ data: org }, { data: courtsData }, { data: matches }, { data: me }] = await Promise.all([
    supabase.rpc("public_org").maybeSingle(),
    supabase.rpc("public_courts"),
    supabase.rpc("public_open_matches"),
    memberId ? supabase.rpc("my_member_profile").maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const timezone = org?.timezone ?? "America/Costa_Rica";
  const today = todayIn(timezone);
  const last = addDays(today, BOOKING_DAYS);
  const date = typeof sp.date === "string" && ISO.test(sp.date) && sp.date >= today && sp.date <= last ? sp.date : today;
  const { data: dayRows } = await supabase.rpc("public_court_day", { p_date: date });
  const now = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: timezone }).format(new Date());

  const courts = (courtsData ?? []) as PublicCourt[];
  const day = (dayRows ?? []) as DayRow[];
  const q = (d: string) => `/courts${d !== today ? `?date=${d}` : ""}#book`;
  const padel = courts.filter((c) => c.sport === "padel");
  const pickle = courts.filter((c) => c.sport === "pickleball");
  const priceLine = (list: PublicCourt[]) => {
    const prices = [...new Set(list.map((c) => courtMoney(c.price, c.currency)))];
    return prices.length ? `${prices.join(" / ")} / hr` : "";
  };
  const member: Me | null = me
    ? { name: me.name ?? "", email: me.email ?? "", phone: me.phone ?? "" }
    : null;
  const open = (matches ?? []).filter((m) => m.players < m.spots);

  const dayTitle = date === today ? "Today" : fmtDate(date, { weekday: "long" });
  const hours = courts[0] ? `${fmtTime(courts[0].open_time)} to ${fmtTime(courts[0].close_time)}` : "";
  const portalHref = "/portal/schedule?tab=courts";

  return (
    <main className="crts">
      <ArkFonts />
      <header className="crts-nav">
        <Link href="/courts" aria-label="The ARK courts">
          <Logo tone="dark" height={36} />
        </Link>
        <div className="links">
          <a href="#book">Book</a>
          <a href="#matches">Open matches</a>
          <a href="#levels">Levels</a>
          <a href="#info">Info</a>
        </div>
        <div className="right">
          {staff ? (
            <Link href="/events/courts" className="btn sm solid">Staff view</Link>
          ) : memberId ? (
            <Link href={portalHref} className="btn sm solid">Sign in</Link>
          ) : (
            <>
              <Link href="/portal/login?next=/courts" className="login">Sign in</Link>
              <a href="#book" className="btn sm solid">Book a court</a>
            </>
          )}
        </div>
      </header>

      <section className="crts-hero">
        <Image src="/courts-hero.jpg" alt="" fill priority sizes="100vw" className="bg" />
        <div className="in">
          <div className="copy">
            <p className="eyebrow">The ARK · Santa Teresa</p>
            <h1>Padel &amp; pickleball</h1>
            <p className="crts-lede">
              {padel.length} padel court{padel.length === 1 ? "" : "s"}
              {pickle.length ? ` and ${pickle.length} pickleball court${pickle.length === 1 ? "" : "s"}` : ""}.
              {hours ? ` Open ${hours}, daily.` : ""}
            </p>
            <div className="btn-row">
              <a href="#book" className="btn gold">Book a court</a>
              <a href="#matches" className="btn ghost-light">Join an open match</a>
            </div>
          </div>
          <div className="crts-prices">
            {padel.length > 0 && (
              <div className="row">
                <span className="name">Padel</span>
                <span>{priceLine(padel)}</span>
              </div>
            )}
            {pickle.length > 0 && (
              <div className="row">
                <span className="name">Pickleball</span>
                <span>{priceLine(pickle)}</span>
              </div>
            )}
            <div className="row">
              <span className="name">Members</span>
              <span className="member">10% off · 20% on Annual</span>
            </div>
          </div>
        </div>
      </section>

      <section className="crts-sec" id="book">
        <div className="wrap">
          <div className="crts-sec-h">
            <div>
              <p className="eyebrow">Book</p>
              <h2>Available courts</h2>
            </div>
            {courts.length > 0 && (
              <div className="crts-date">
                <Link
                  className="crts-step"
                  href={q(addDays(date, -1))}
                  aria-label="Previous day"
                  aria-disabled={date <= today}
                  tabIndex={date <= today ? -1 : undefined}
                >
                  ‹
                </Link>
                <div className="label" aria-live="polite">
                  <b>{dayTitle}</b>
                  <span>{fmtDate(date, { month: "long", day: "numeric", ...(date === today ? { weekday: "long" } : {}) })}</span>
                </div>
                <Link
                  className="crts-step"
                  href={q(addDays(date, 1))}
                  aria-label="Next day"
                  aria-disabled={date >= last}
                  tabIndex={date >= last ? -1 : undefined}
                >
                  ›
                </Link>
              </div>
            )}
          </div>
          {!courts.length ? (
            <div className="crts-empty">
              <h3>No courts to book right now</h3>
              <p className="muted">Ask us at reception.</p>
            </div>
          ) : (
            <>
              <div className="crts-card-cal">
                <CourtBooker courts={courts} day={day} date={date} today={today} now={now} me={member} online={stripeReady()} />
              </div>
              <p className="crts-hint">
                Pick a free slot to book it, or a gold one to join an open match. Members save in the{" "}
                <Link href={portalHref}>members portal</Link>.
              </p>
            </>
          )}
        </div>
      </section>

      <section className="crts-sec panel" id="matches">
        <div className="wrap">
          <div className="crts-matches-top">
            <div className="copy">
              <p className="eyebrow">Open matches</p>
              <h2>Short a player? Open the game.</h2>
              <p className="muted">Book a court, open it to the village, and split the cost with whoever joins.</p>
              <a href="#book" className="btn solid">Start an open match</a>
            </div>
            <ol className="crts-steps">
              <li><span className="num">1</span><strong>Set the game</strong><span>Choose your level and how many players you need.</span></li>
              <li><span className="num">2</span><strong>Others join</strong><span>Players find it here and pay their share to take a spot.</span></li>
              <li><span className="num">3</span><strong>Share the link</strong><span>Send it to your group chat to fill the court faster.</span></li>
            </ol>
          </div>
          {open.length > 0 && (
            <div className="crts-live">
              <h3>Playing soon</h3>
              <div className="crts-matches">
                {open.map((m) => (
                  <article key={m.booking_id} className="crts-match">
                    <div className="top">
                      <b>{m.court}</b>
                      <span className="sport">{sportName(m.sport)}</span>
                    </div>
                    <div className="when">
                      {m.date === today ? "Today" : fmtDate(m.date, { weekday: "long", month: "short", day: "numeric" })},{" "}
                      {fmtTime(m.start_time)}–{fmtTime(m.end_time)}
                    </div>
                    <div className="meta">
                      Level {levelRange(m.level_min, m.level_max)} · hosted by {m.host}
                    </div>
                    <div className="dots" aria-label={`${m.players} of ${m.spots} players`}>
                      {Array.from({ length: m.spots }, (_, i) => (
                        <span key={i} className={i < m.players ? "in" : ""} />
                      ))}
                    </div>
                    <div className="act">
                      <b>
                        {m.spots - m.players} spot{m.spots - m.players === 1 ? "" : "s"} left · {courtMoney(m.share, m.currency)} each
                      </b>
                      <Link className="btn sm solid" href={`/courts/join/${m.booking_id}`}>Join</Link>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="crts-sec" id="levels">
        <div className="wrap">
          <div className="crts-sec-h">
            <div>
              <p className="eyebrow">Levels</p>
              <h2>Find your game.</h2>
            </div>
            <p>Set a level on your open match so the right players join.</p>
          </div>
          <div className="crts-level-grid">
            {LEVELS.map(([v, name, desc]) => (
              <article key={v} className="crts-level">
                <span className="n">{v}</span>
                <div>
                  <strong>{name}</strong>
                  <span>{desc}.</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="crts-sec white" id="info">
        <div className="wrap">
          <div className="crts-sec-h">
            <div>
              <p className="eyebrow">Info</p>
              <h2>Good to know.</h2>
            </div>
          </div>
          <div className="crts-info">
            <div className="crts-info-card">
              <h3>Booking</h3>
              <ul>
                <li>Up to {BOOKING_DAYS} days ahead, two bookings a day.</li>
                <li>{stripeReady() ? `Pay by card to confirm. Held ${HOLD_MINUTES} min while you pay.` : "Pay at reception."}</li>
                <li>Rackets and balls at reception.</li>
              </ul>
            </div>
            <div className="crts-info-card">
              <h3>Cancelling</h3>
              <p>Free up to 24 hours before, refunded to your card. Later than that, message us.</p>
            </div>
            <div className="crts-info-card">
              <h3>Where</h3>
              <p>
                {org?.name ?? "The ARK"}, {org?.location ?? "Santa Teresa, Costa Rica"}.{hours ? ` Open ${hours}, daily.` : ""}
              </p>
            </div>
          </div>
          <div className="crts-band dark">
            <div>
              <h3>Members play for less.</h3>
              <p>10% off every booking, 20% on Annual, applied automatically when you book in the members portal.</p>
            </div>
            <div className="btn-row">
              <Link href={portalHref} className="btn gold">Book in the portal</Link>
              <Link href="/ark-membership" className="btn ghost-light">Become a member</Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="crts-foot dark">
        <div className="wrap">
          <span className="brand">
            <Logo tone="light" kind="mark" height={32} /> {org?.name ?? "The ARK"} · {org?.location ?? "Santa Teresa, Costa Rica"}
          </span>
          <div className="links">
            <Link href="/ark-membership">Membership</Link>
            <Link href="/stay">Stay</Link>
            <Link href="/portal/login?next=/courts">Sign in</Link>
            <a href="#info">Info</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
