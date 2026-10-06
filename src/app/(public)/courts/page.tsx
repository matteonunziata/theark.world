import type { Metadata } from "next";
import Link from "next/link";
import { ArkFonts } from "@/components/ark-fonts";
import { Logo } from "@/components/logo";
import { getViewer } from "@/lib/auth";
import { BOOKING_DAYS, courtMoney, LEVELS, levelRange, type PublicCourt, SPORTS, sportName } from "@/lib/courts";
import { addDays, DOW, fmtDate, fmtTime, todayIn } from "@/lib/dates";
import { stripeReady } from "@/lib/stripe";
import { CourtBooker, type DayRow, type Me } from "./court-booker";
import "./courts.css";

export const metadata: Metadata = {
  title: { absolute: "Book a court — The ARK, Santa Teresa" },
  description:
    "Two padel courts and a pickleball court in Santa Teresa, Costa Rica. See what’s free, book and pay online, or join an open match.",
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
  const sport = typeof sp.sport === "string" && SPORTS.some(([k]) => k === sp.sport) ? sp.sport : "";
  const { data: dayRows } = await supabase.rpc("public_court_day", { p_date: date });
  const now = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: timezone }).format(new Date());

  const courts = (courtsData ?? []) as PublicCourt[];
  const shown = courts.filter((c) => !sport || c.sport === sport);
  const day = (dayRows ?? []) as DayRow[];
  const days = Array.from({ length: BOOKING_DAYS + 1 }, (_, i) => addDays(today, i));
  const q = (next: { date?: string; sport?: string }) => {
    const s = new URLSearchParams();
    const d = next.date ?? date;
    const sp2 = next.sport ?? sport;
    if (d !== today) s.set("date", d);
    if (sp2) s.set("sport", sp2);
    const str = s.toString();
    return `/courts${str ? `?${str}` : ""}`;
  };
  const padel = courts.filter((c) => c.sport === "padel");
  const pickle = courts.filter((c) => c.sport === "pickleball");
  const priceLine = (list: PublicCourt[]) => {
    const prices = [...new Set(list.map((c) => courtMoney(c.price, c.currency)))];
    return prices.length ? `${prices.join(" / ")} an hour` : "";
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
          <a href="#info" className="hide-sm">Good to know</a>
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
        <p className="eyebrow">Courts at The ARK, Santa Teresa</p>
        <h1>
          Padel and pickleball, <em>under the trees</em>
        </h1>
        <p className="crts-lede">
          {padel.length} padel court{padel.length === 1 ? "" : "s"}
          {pickle.length ? ` and ${pickle.length} pickleball court${pickle.length === 1 ? "" : "s"}` : ""}, open
          {courts[0] ? ` ${fmtTime(courts[0].open_time)} to ${fmtTime(courts[0].close_time)}` : ""} every day. Pick a
          free hour, book it and pay online, or join an open match and we’ll find you a game.
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
          <li>
            Book up to <b>two weeks ahead</b>
          </li>
        </ul>
      </section>

      {open.length > 0 && (
        <section className="crts-sec tint" id="matches">
          <div className="crts-sec-h">
            <h2>Open matches</h2>
            <p className="muted">Pay only for your spot. Level is self-rated, 0 to 7.</p>
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
        <div className="crts-sec-h">
          <h2>Book a court</h2>
          <p className="muted">Tap a free hour. One or two hours at a time.</p>
        </div>
        <div className="crts-tools">
          <div className="crts-days">
            {days.map((d) => (
              <Link key={d} href={q({ date: d })} aria-current={d === date ? "page" : undefined} className={d === today ? "today" : ""}>
                <span>{DOW[new Date(`${d}T00:00:00Z`).getUTCDay()]}</span>
                <b>{Number(d.slice(8))}</b>
                <small>{fmtDate(d, { month: "short" })}</small>
              </Link>
            ))}
          </div>
          <div className="crts-pills" role="group" aria-label="Sport">
            <Link href={q({ sport: "" })} aria-current={!sport ? "page" : undefined}>All courts</Link>
            {SPORTS.map(([k, l]) => (
              <Link key={k} href={q({ sport: k })} aria-current={sport === k ? "page" : undefined}>{l}</Link>
            ))}
          </div>
        </div>
        <p className="crts-day-title">
          {date === today ? "Today, " : ""}
          {fmtDate(date, { weekday: "long", month: "long", day: "numeric" })}
        </p>

        {!shown.length ? (
          <div className="crts-empty">
            <h3>No courts to book right now</h3>
            <p className="muted">Ask us at reception.</p>
          </div>
        ) : (
          <CourtBooker
            courts={shown}
            day={day}
            date={date}
            today={today}
            now={now}
            me={member}
            online={stripeReady()}
          />
        )}
      </section>

      <section className="crts-sec tint" id="info">
        <div className="crts-info">
          <div>
            <h3>How it works</h3>
            <ul>
              <li>Pick a court and a free hour, up to two weeks ahead, two slots a day.</li>
              <li>{stripeReady() ? "Pay by card to confirm. Your slot is held for 20 minutes while you pay." : "Book now and settle at reception when you arrive."}</li>
              <li>Members get their tier’s discount (10% on a monthly membership and longer, 20% on Annual); sign in first so it applies.</li>
              <li>Rackets, paddles and balls are at reception.</li>
            </ul>
          </div>
          <div>
            <h3>Open matches</h3>
            <ul>
              <li>Book a court as an open match: say your level and how many players you want.</li>
              <li>Others join from this page and pay their own share.</li>
              <li>Share your match link with friends to fill it faster.</li>
              <li>Leave a match any time while it isn’t full, otherwise up to 24 hours before.</li>
            </ul>
          </div>
          <div>
            <h3>Cancelling</h3>
            <p>
              Cancel from your booking page up to 24 hours before the start. Anything paid is refunded to the card.
              Later than that, message us and we’ll do what we can.
            </p>
            <h3>Where</h3>
            <p>{org?.name ?? "The ARK"}, {org?.location ?? "Santa Teresa, Costa Rica"}.</p>
          </div>
          <div>
            <h3>Your level</h3>
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
