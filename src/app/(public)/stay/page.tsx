import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { getViewer } from "@/lib/auth";
import { addDays, fmtDate, todayIn } from "@/lib/dates";
import { estatePhoto, nights } from "@/lib/estate";
import { money } from "@/lib/schedule";

export const metadata: Metadata = {
  title: { absolute: "Stay at The ARK" },
  description: "Homes at The ARK in Santa Teresa, Costa Rica, offered by the families who live here.",
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export default async function StayPage({ searchParams }: PageProps<"/stay">) {
  const sp = await searchParams;
  const today = todayIn();
  const checkIn = typeof sp.in === "string" && ISO.test(sp.in) && sp.in >= today ? sp.in : "";
  const checkOut = typeof sp.out === "string" && ISO.test(sp.out) && checkIn && sp.out > checkIn ? sp.out : "";
  const guests = Math.min(20, Math.max(0, Number(sp.guests) || 0));
  const dated = !!(checkIn && checkOut);
  const n = dated ? nights(checkIn, checkOut) : 0;

  const { supabase } = await getViewer();
  const { data } = await supabase.rpc("public_listings", {
    p_check_in: dated ? checkIn : null,
    p_check_out: dated ? checkOut : null,
    p_guests: guests || null,
  });
  const homes = [...(data ?? [])].sort((a, b) => Number(b.available) - Number(a.available));
  const qs = new URLSearchParams({ ...(checkIn && { in: checkIn }), ...(checkOut && { out: checkOut }), ...(guests && { guests: String(guests) }) }).toString();

  return (
    <main className="stay">
      <header className="stay-top">
        <Link href="/stay" aria-label="The ARK stays">
          <Logo tone="dark" height={30} />
        </Link>
        <span>Stays</span>
      </header>

      <section className="stay-hero">
        <h1>Stay at The ARK</h1>
        <p>
          Homes on the land in Santa Teresa, offered by the families who live here
          while they’re away. Farm breakfasts, the club, and the beach a short walk down the hill.
        </p>
        <form className="stay-search" method="get">
          <label>
            <span>Check-in</span>
            <input type="date" name="in" min={today} defaultValue={checkIn} />
          </label>
          <label>
            <span>Check-out</span>
            <input type="date" name="out" min={checkIn ? addDays(checkIn, 1) : addDays(today, 1)} defaultValue={checkOut} />
          </label>
          <label>
            <span>Guests</span>
            <select name="guests" defaultValue={guests ? String(guests) : ""}>
              <option value="">Any</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </label>
          <button type="submit">Search</button>
        </form>
      </section>

      <section className="stay-results">
        <p className="stay-count">
          {dated
            ? `${homes.filter((h) => h.available).length} of ${homes.length} homes free, ${fmtDate(checkIn, { month: "short", day: "numeric" })} to ${fmtDate(checkOut, { month: "short", day: "numeric" })} (${n} night${n === 1 ? "" : "s"})`
            : `${homes.length} home${homes.length === 1 ? "" : "s"}`}
          {guests ? ` for ${guests} guest${guests === 1 ? "" : "s"}` : ""}
        </p>
        {!homes.length ? (
          <div className="stay-empty">
            <h2>No homes to show yet</h2>
            <p>Try other dates or fewer guests, or write to us and we’ll help you find a place.</p>
          </div>
        ) : (
          <div className="stay-grid">
            {homes.map((h) => {
              const photo = estatePhoto(h.cover_path);
              const total = h.nightly_rate !== null && dated ? Number(h.nightly_rate) * n + Number(h.cleaning_fee ?? 0) : null;
              return (
                <Link key={h.id} href={`/stay/${h.id}${qs ? `?${qs}` : ""}`} className={`stay-card ${h.available ? "" : "off"}`}>
                  <div className="img">
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt="" loading="lazy" />
                    ) : (
                      <span />
                    )}
                    {dated && !h.available && <span className="tag">Not free these dates</span>}
                  </div>
                  <div className="body">
                    <h2>{h.title}</h2>
                    <span className="meta">
                      {[h.zone, h.bedrooms !== null ? `${h.bedrooms} bedroom${h.bedrooms === 1 ? "" : "s"}` : null, h.max_guests ? `sleeps ${h.max_guests}` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    {h.amenities.length > 0 && <span className="amen-line">{h.amenities.slice(0, 4).join(" · ")}</span>}
                    <span className="price">
                      {h.nightly_rate !== null ? (
                        <>
                          <b>{money(h.nightly_rate, h.rate_currency)}</b> a night
                          {total !== null && h.available ? <span className="muted"> · {money(total, h.rate_currency)} total</span> : null}
                        </>
                      ) : (
                        "Ask for rates"
                      )}
                    </span>
                    {h.min_nights > 1 && <span className="muted small">{h.min_nights}-night minimum</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
      <footer className="stay-foot">The ARK · Santa Teresa, Costa Rica</footer>
    </main>
  );
}
