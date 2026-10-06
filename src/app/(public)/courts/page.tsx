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
  const [{ data: org }, { data: courtsData }, { data: matches }, { data: me }, { data: discount }] = await Promise.all([
    supabase.rpc("public_org").maybeSingle(),
    supabase.rpc("public_courts"),
    supabase.rpc("public_open_matches"),
    memberId ? supabase.rpc("my_member_profile").maybeSingle() : Promise.resolve({ data: null }),
    supabase.rpc("my_court_discount"),
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
    ? { name: me.name ?? "", email: me.email ?? "", phone: me.phone ?? "", discount: Number(discount ?? 0) }
    : null;
  const open = (matches ?? []).filter((m) => m.players < m.spots);

  return (
    <main className="crts">
      <ArkFonts />
      <header className="crts-nav">
        <Link href="/courts" aria-label="The ARK courts">
          <Logo tone="dark" height={32} />
        </Link>
        <nav>
          <a href="#book" className="hide-sm">Book</a>
          <a href="#matches" className="hide-sm">Open matches</a>
          <a href="#info" className="hide-sm">Info</a>
          {staff ? (
            <Link href="/events/courts" className="btn sm">Staff view</Link>
          ) : memberId ? (
            <Link href="/portal/schedule?tab=courts" className="btn sm">Members portal</Link>
          ) : (
            <Link href="/portal/login?next=/courts" className="btn sm">Member log in</Link>
          )}
        </nav>
      </header>

      <section className="crts-hero">
        <Image src="/courts-hero.jpg" alt="" fill priority sizes="100vw" className="bg" />
        <div className="in">
          <p className="eyebrow">The ARK · Santa Teresa</p>
          <h1>Padel &amp; pickleball</h1>
          <p className="crts-lede">
            {padel.length} padel court{padel.length === 1 ? "" : "s"}
            {pickle.length ? ` and ${pickle.length} pickleball court${pickle.length === 1 ? "" : "s"}` : ""}.
            {courts[0] ? ` Open ${fmtTime(courts[0].open_time)} to ${fmtTime(courts[0].close_time)}, daily.` : ""}
          </p>
          <ul className="crts-facts">
            {padel.length > 0 && (
              <li>
                Padel <b>{priceLine(padel)}</b>
              </li>
            )}
            {pickle.length > 0 && (
              <li>
                Pickleball <b>{priceLine(pickle)}</b>
              </li>
            )}
            <li>
              Members <b>{member?.discount ? `${member.discount}% off` : "10% off"}</b>
            </li>
          </ul>
          <a href="#book" className="btn solid">Book a court</a>
        </div>
      </section>

      {open.length > 0 && (
        <section className="crts-sec tint" id="matches">
          <div className="crts-sec-h">
            <h2>Open matches</h2>
            <p className="muted">Join a game. Pay your share.</p>
          </div>
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
        </section>
      )}

      <section className="crts-sec" id="book">
        <h2>Available courts</h2>
        {!courts.length ? (
          <div className="crts-empty">
            <h3>No courts to book right now</h3>
            <p className="muted">Ask us at reception.</p>
          </div>
        ) : (
          <div className="crts-card-cal">
            <div className="crts-bar">
              <Link
                className="crts-step"
                href={q(addDays(date, -1))}
                aria-label="Previous day"
                aria-disabled={date <= today}
                tabIndex={date <= today ? -1 : undefined}
              >
                ‹
              </Link>
              <b>{date === today ? "Today" : fmtDate(date, { weekday: "short", month: "short", day: "numeric" })}</b>
              <Link
                className="crts-step"
                href={q(addDays(date, 1))}
                aria-label="Next day"
                aria-disabled={date >= last}
                tabIndex={date >= last ? -1 : undefined}
              >
                ›
              </Link>
              <span className="muted">{fmtDate(date, { weekday: "long", month: "long", day: "numeric" })}</span>
            </div>
            <CourtBooker courts={courts} day={day} date={date} today={today} now={now} me={member} online={stripeReady()} />
          </div>
        )}
      </section>

      <section className="crts-sec tint" id="info">
        <div className="crts-info">
          <div>
            <h3>Booking</h3>
            <ul>
              <li>Up to {BOOKING_DAYS} days ahead, two bookings a day.</li>
              <li>{stripeReady() ? `Pay by card to confirm. Held ${HOLD_MINUTES} min while you pay.` : "Pay at reception."}</li>
              <li>Members: 10% off, 20% on Annual. Sign in first.</li>
              <li>Rackets and balls at reception.</li>
            </ul>
          </div>
          <div>
            <h3>Open matches</h3>
            <ul>
              <li>Set your level and how many players.</li>
              <li>Others join here and pay their share.</li>
              <li>Share the link to fill it faster.</li>
            </ul>
          </div>
          <div>
            <h3>Cancelling</h3>
            <p>Free up to 24 hours before, refunded to your card. Later, message us.</p>
            <h3>Where</h3>
            <p>{org?.name ?? "The ARK"}, {org?.location ?? "Santa Teresa, Costa Rica"}.</p>
          </div>
          <div>
            <h3>Levels</h3>
            <ul className="crts-levels">
              {LEVELS.map(([v, name, desc]) => (
                <li key={v}>
                  <b>{v}</b>
                  <span>
                    {name}. <span className="muted">{desc}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <p className="crts-foot">
        {org?.name ?? "The ARK"} · <Link href="/ark-membership">Membership</Link> · <Link href="/stay">Stay</Link>
      </p>
    </main>
  );
}
