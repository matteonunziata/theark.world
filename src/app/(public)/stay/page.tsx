import type { Metadata } from "next";
import Link from "next/link";
import { ArkFonts } from "@/components/ark-fonts";
import { Logo } from "@/components/logo";
import { getViewer } from "@/lib/auth";
import { addDays, fmtDate, todayIn } from "@/lib/dates";
import { estatePhoto, nights } from "@/lib/estate";
import { money } from "@/lib/schedule";
import "../whats-on/events.css";
import { EnquiryForm } from "./enquiry-form";
import "./stay.css";

export const metadata: Metadata = {
  title: { absolute: "Stay at The ARK — Santa Teresa" },
  description:
    "Homes on the land in Santa Teresa, Costa Rica. Sleep on the hill, eat from the Farm, and live the ARK day, for a night or a season.",
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MEMBERSHIP = "/ark-membership";
const SHOWN = 6;

const PERKS = [
  ["Full access", "ARK House, Shala, Space Deck and Jungle Gym, 8am to 8pm."],
  ["Every class", "Yoga, Muay Thai, strength and more on the member schedule."],
  ["Courts", "Book padel and pickleball."],
  ["The village", "Dinners, circles and events. You arrive already part of it."],
] as const;

const PLANS = [
  ["Breakfast", "Breakfast every day", false],
  ["Breakfast & lunch", "Two meals every day", true],
  ["Lunch", "Lunch every day", false],
] as const;

const EXPERIENCES = [
  ["Jungle adventures", "Guided hikes through the forest around Santa Teresa: wildlife, viewpoints and hidden beaches."],
  ["Waterfall tours", "A morning out to the waterfalls of the Nicoya Peninsula, with time to swim."],
  ["ATV tours", "Ride the backroads and ridgelines between the jungle and the coast."],
  ["Catamaran trips", "A day on the Pacific with the village: sun, swims and good company."],
  ["Farm-to-table dinners", "An intimate long-table dinner with what the Farm grew that week."],
  ["Circles & workshops", "Breathwork, men’s and women’s circles and business workshops through the week."],
] as const;

export default async function StayPage({ searchParams }: PageProps<"/stay">) {
  const sp = await searchParams;
  const today = todayIn();
  const checkIn = typeof sp.in === "string" && ISO.test(sp.in) && sp.in >= today ? sp.in : "";
  const checkOut = typeof sp.out === "string" && ISO.test(sp.out) && checkIn && sp.out > checkIn ? sp.out : "";
  const guests = Math.min(20, Math.max(0, Number(sp.guests) || 0));
  const dated = !!(checkIn && checkOut);
  const n = dated ? nights(checkIn, checkOut) : 0;
  const showAll = sp.all === "1";

  const { supabase, memberId, staff } = await getViewer();
  const { data } = await supabase.rpc("public_listings", {
    p_check_in: dated ? checkIn : null,
    p_check_out: dated ? checkOut : null,
    p_guests: guests || null,
  });
  const homes = [...(data ?? [])].sort((a, b) => Number(b.available) - Number(a.available));
  const shown = showAll ? homes : homes.slice(0, SHOWN);
  const qs = new URLSearchParams({
    ...(checkIn && { in: checkIn }),
    ...(checkOut && { out: checkOut }),
    ...(guests && { guests: String(guests) }),
  }).toString();
  const allQs = new URLSearchParams(qs);
  allQs.set("all", "1");

  const summary = dated && homes.length
    ? `${homes.filter((h) => h.available).length} of ${homes.length} homes free, ${fmtDate(checkIn, { month: "short", day: "numeric" })} to ${fmtDate(checkOut, { month: "short", day: "numeric" })} (${n} night${n === 1 ? "" : "s"})${guests ? ` for ${guests} guest${guests === 1 ? "" : "s"}` : ""}`
    : "Every home is a short walk from the ARK House, the Shala and the Space Deck.";

  return (
    <main className="evp hsp">
      <ArkFonts />
      <header>
        <nav aria-label="Main">
          <Link href="/stay" aria-label="The ARK stays">
            <Logo tone="dark" height={40} />
          </Link>
          <div className="nav-links">
            <a href="#book">Book</a>
            <a href="#stays">Stays</a>
            <a href="#meals">Meals</a>
            <a href="#experiences">Experiences</a>
            <a href="#travel">Travel</a>
            <a href="#info">Info</a>
          </div>
          <div className="nav-right">
            {staff ? (
              <Link href="/hospitality" className="btn btn-primary sm">Staff view</Link>
            ) : memberId ? (
              <Link href="/portal" className="btn btn-primary sm">Sign in</Link>
            ) : (
              <>
                <Link className="nav-login" href="/portal/login?next=/stay">Sign in</Link>
                <a className="btn btn-primary sm" href="#book">Book a stay</a>
              </>
            )}
          </div>
        </nav>
      </header>

      <section id="book" className="hero dark">
        <div className="wrap">
          <div className="hero-copy">
            <p className="eyebrow">The ARK · Santa Teresa</p>
            <h1>Stay at The ARK</h1>
            <p className="hero-sub">
              Sleep on the hill, eat from the Farm, and live the ARK day — for a night or a season.
            </p>
          </div>
          <form className="booking" method="get" action="/stay#stays">
            <label className="field">
              <span className="field-label">Check in</span>
              <input type="date" name="in" min={today} defaultValue={checkIn} required />
            </label>
            <label className="field">
              <span className="field-label">Check out</span>
              <input type="date" name="out" min={checkIn ? addDays(checkIn, 1) : addDays(today, 1)} defaultValue={checkOut} required />
            </label>
            <label className="field">
              <span className="field-label">Guests</span>
              <select name="guests" defaultValue={guests ? String(guests) : "2"}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
                  <option key={g} value={g}>{g} guest{g === 1 ? "" : "s"}</option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn btn-primary search">Check availability</button>
          </form>
        </div>
      </section>

      <section id="stays" className="listings">
        <div className="wrap">
          <div className="section-head">
            <div>
              <p className="eyebrow">Stays</p>
              <h2>Our homes</h2>
            </div>
            <p>{summary}</p>
          </div>
          {!homes.length ? (
            <p className="empty">No homes to show for these dates. Try other dates or fewer guests, or write to us below and we’ll help you find a place.</p>
          ) : (
            <div className="listing-grid">
              {shown.map((h) => {
                const photo = estatePhoto(h.cover_path);
                const total = h.nightly_rate !== null && dated ? Number(h.nightly_rate) * n + Number(h.cleaning_fee ?? 0) : null;
                const href = `/stay/${h.id}${qs ? `?${qs}` : ""}`;
                return (
                  <article key={h.id} className={`listing${h.available ? "" : " off"}`}>
                    <div className="ph">
                      {photo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photo} alt="" loading="lazy" />
                      )}
                      {dated && !h.available && <span className="tag">Not free these dates</span>}
                    </div>
                    <div className="listing-head">
                      <h3><Link href={href}>{h.title}</Link></h3>
                      {h.zone && <span className="tag">{h.zone}</span>}
                    </div>
                    <span className="specs">
                      {[
                        h.max_guests ? `${h.max_guests} guests` : null,
                        h.bedrooms !== null ? `${h.bedrooms} bedroom${h.bedrooms === 1 ? "" : "s"}` : null,
                        h.min_nights > 1 ? `${h.min_nights}-night minimum` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    <div className="listing-foot">
                      <span>
                        {h.nightly_rate !== null ? (
                          <>
                            <strong>{money(h.nightly_rate, h.rate_currency)}</strong> <span className="per">/ night</span>
                            {total !== null && h.available ? <span className="per"> · {money(total, h.rate_currency)} total</span> : null}
                          </>
                        ) : (
                          <span className="per">Ask for rates</span>
                        )}
                      </span>
                      <Link className="btn btn-ghost" href={href}>{dated && h.available ? "Reserve" : "View home"}</Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          {!showAll && homes.length > SHOWN && (
            <div className="see-all">
              <Link className="btn btn-ghost" href={`/stay?${allQs}#stays`}>See all {homes.length} homes</Link>
            </div>
          )}
        </div>
      </section>

      <section className="included">
        <div className="wrap">
          <div className="included-copy">
            <p className="eyebrow">Every stay</p>
            <h2>More than a room.</h2>
            <p>
              Guests live the same day our members do — classes in the Shala, deep work in the ARK House, and sunsets
              on the Space Deck.
            </p>
          </div>
          <div className="perks">
            {PERKS.map(([t, d]) => (
              <div key={t} className="perk"><strong>{t}</strong><span>{d}</span></div>
            ))}
          </div>
        </div>
      </section>

      <section id="meals" className="meals">
        <div className="wrap">
          <div className="meals-intro">
            <p className="eyebrow">Meal service · La Cocineta</p>
            <h2>From the Farm to your table.</h2>
            <p>
              Chef-cooked breakfast and lunch, every day, made with what’s growing on the Farm. Add a plan to your stay,
              by the day, the week or the month.
            </p>
          </div>
          <div className="plans">
            {PLANS.map(([name, line, featured]) => (
              <article key={name} className={`plan${featured ? " featured" : ""}`}>
                <div className="plan-head">
                  <h3>{name}</h3>
                  {featured && <span className="badge">Most chosen</span>}
                </div>
                <span className="meals-line">{line}</span>
                <a className={`btn ${featured ? "btn-accent" : "btn-primary"}`} href="#ask">Ask about this plan</a>
              </article>
            ))}
          </div>
          <p className="diet-note">Dietary needs? Tell us when you book and we’ll plan around them.</p>
        </div>
      </section>

      <section id="experiences" className="experiences">
        <div className="wrap">
          <div className="exp-head">
            <h2>Experiences</h2>
            <span>Book with your stay, or ask us once you’re here.</span>
          </div>
          <div className="exp-grid">
            {EXPERIENCES.map(([t, d]) => (
              <article key={t} className="exp">
                <h3>{t}</h3>
                <p>{d}</p>
              </article>
            ))}
          </div>
          <a className="btn btn-ghost center" href="#ask">Ask about experiences</a>
        </div>
      </section>

      <section id="travel" className="travel">
        <div className="wrap">
          <div className="section-head">
            <div>
              <p className="eyebrow">Getting here</p>
              <h2>We’ll get you here.</h2>
            </div>
            <p>
              Santa Teresa is worth the journey. Tell us when you land and we’ll arrange the rest — flights and
              shuttles, door to door.
            </p>
          </div>
          <div className="travel-grid">
            <article className="travel-card">
              <h3>Flights</h3>
              <p>Short domestic flights from San José to the airstrip closest to Santa Teresa, booked for you.</p>
              <ul className="checks">
                <li>Timed to your international arrival</li>
                <li>Met at the airstrip and driven to The ARK</li>
                <li>Return flights arranged too</li>
              </ul>
            </article>
            <article className="travel-card">
              <h3>Shuttle service</h3>
              <p>Private or shared shuttles from the airport straight to The ARK.</p>
              <ul className="checks">
                <li>From San José (SJO) or Liberia (LIR)</li>
                <li>Private or shared, any time of day</li>
                <li>Ferry or road route, whichever is best that day</li>
              </ul>
            </article>
          </div>
          <div className="travel-cta">
            <a className="btn btn-primary" href="#ask">Arrange my travel</a>
            <span>Add it when you book, or message us with your flight details.</span>
          </div>
        </div>
      </section>

      <section id="info" className="info">
        <div className="wrap">
          <div className="section-head">
            <div>
              <p className="eyebrow">Info</p>
              <h2>Before you arrive.</h2>
            </div>
          </div>
          <div className="info-grid">
            <div className="info-card"><h3>Check-in &amp; out</h3><p>Each home lists its own check-in and check-out times.</p></div>
            <div className="info-card"><h3>Confirming</h3><p>Send a request and we’ll confirm within a day. Nothing is charged until we do.</p></div>
            <div className="info-card"><h3>Getting here</h3><p>Santa Teresa, on Costa Rica’s Nicoya Peninsula. We can arrange <a href="#travel">flights and shuttles</a>.</p></div>
            <div className="info-card"><h3>Questions</h3><p>Use the form below and we’ll write back.</p></div>
          </div>
          <div className="members-band dark">
            <div>
              <h3>Staying a while?</h3>
              <p>If you’re here for a season, membership may be the better way in. Apply and we’ll help you choose.</p>
            </div>
            <div className="btn-row">
              <Link className="btn btn-accent" href={`${MEMBERSHIP}/apply`}>Apply for membership</Link>
              <Link className="btn btn-ghost-light" href={MEMBERSHIP}>See membership</Link>
            </div>
          </div>
        </div>
      </section>

      <section id="ask" className="host">
        <div className="wrap">
          <div className="host-copy">
            <p className="eyebrow">Ask us</p>
            <h2>Meals, experiences, travel.</h2>
            <p>Tell us what you’d like to add to your stay and we’ll come back with options and prices.</p>
          </div>
          <EnquiryForm />
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
            <Link href="/portal/login?next=/stay">Sign in</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
