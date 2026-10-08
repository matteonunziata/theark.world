import type { Metadata } from "next";
import { EventLink } from "../booking-modal";
import Link from "next/link";
import { reason, suggestions } from "@/lib/connect";
import { coverUrl } from "@/lib/covers";
import { addDays, DOW, dayLabel, dow, timeRange, todayIn } from "@/lib/dates";
import { loadGoing, loadPortal } from "@/lib/portal";
import { priceLabel, sessions, whenLabel } from "@/lib/schedule";
import { Av, PersonCard, SectionHead, SessionCard } from "../ui";
import { WeekTabs } from "./week-tabs";

export const metadata: Metadata = { title: "Sign in" };

// The jungle-and-ocean shot behind the greeting. Drop the photo at public/portal/hero.jpg;
// until it's there the Spa Deck photo from the main site shows instead.
const HERO = [
  "/portal/hero.jpg",
  "https://vibe.filesafe.space/1776339959982732737/attachments/30ca26f5-6138-400d-a687-4f9407f14783.jpg",
]
  .map((u) => `url(${u})`)
  .join(", ");

const greeting = (tz: string) => {
  const h = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: tz }).format(new Date()),
  );
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

export default async function PortalHome() {
  const p = await loadPortal();
  const { supabase, me, city } = p;
  const today = todayIn(p.timezone);

  const [offerings, tickets, cancels, facs, dir, going, myRegs] = await Promise.all([
    supabase.from("offerings").select("*").eq("status", "published"),
    supabase.from("ticket_types").select("*"),
    supabase.from("session_cancellations").select("offering_id, session_date").gte("session_date", today),
    supabase.rpc("facilitator_names"),
    supabase.rpc("member_directory"),
    loadGoing(p, today, addDays(today, 6)),
    me
      ? supabase
          .from("registrations")
          .select("id, session_date, qr_token, status, offering:offerings(title, start_time, end_time, location)")
          .or(`user_id.eq.${p.user!.id},contact_id.eq.${me.id}`)
          .order("session_date")
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const all = offerings.data ?? [];
  const fac = (id: string | null) => (facs.data ?? []).find((f) => f.id === id)?.name;
  const inCity = all.filter((o) => !city || o.city_id === city.id || !o.city_id);
  const week = sessions(inCity.filter((o) => o.kind !== "expedition"), cancels.data ?? [], today, addDays(today, 6), {
    published: true,
  });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(today, i)).map((date, i) => {
    const items = week.filter((s) => s.date === date);
    return {
      date,
      label: i === 0 ? "Today" : `${DOW[dow(date)]} ${Number(date.slice(8))}`,
      count: items.filter((s) => !s.cancelled).length,
      content: items.length ? (
        <div className="pv-rail">
          {items.map((s) => (
            <SessionCard
              key={`${s.o.id}-${s.date}`}
              o={s.o}
              date={s.date}
              today={today}
              cancelled={s.cancelled}
              facilitator={fac(s.o.facilitator_id)}
              price={priceLabel(s.o, tickets.data ?? [])}
              going={going.get(`${s.o.id}|${s.date}`)}
            />
          ))}
        </div>
      ) : (
        <div className="pv-empty">
          <h3>Nothing on this day</h3>
          <p>Pick another day, or see the full schedule.</p>
        </div>
      ),
    };
  });
  const expeditions = all
    .filter((o) => o.kind === "expedition" && (o.end_date ?? o.start_date) >= today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, 2);
  const people = (dir.data ?? []).filter((x) => !x.is_me);
  const suggested = suggestions(people, me, 3);
  const upcoming = (myRegs.data ?? []).filter((r) => r.session_date >= today && r.offering && r.status === "confirmed");
  const next = upcoming[0];
  const first = (me?.name ?? p.staff?.name ?? "").split(/\s+/)[0];

  return (
    <>
      <section className="pv-hero has-img" style={{ backgroundImage: HERO }}>
        <span className="eyebrow">
          {city ? `${city.name}${city.country ? `, ${city.country}` : ""}` : p.orgName}
        </span>
        <h1>
          {greeting(p.timezone)}
          {first ? `, ${first}` : ""}.
        </h1>
        <p>
          Here’s what’s happening this week, who’s around, and where we’re headed next.
        </p>
        <div className="cta">
          <Link className="pv-btn light" href="/portal/explore">
            See what’s on
          </Link>
          <Link className="pv-btn ghost" href="/portal/people">
            Who’s here
          </Link>
          {p.memberId && (
            <Link className="pv-btn ghost" href="/portal/guests">
              Invite a guest
            </Link>
          )}
        </div>
      </section>

      {next?.offering && (
        <section className="pv-sec">
          <div className="pv-panel" style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <span className="pv-tag">Up next for you</span>
              <h2 style={{ margin: "8px 0 2px" }}>{next.offering.title}</h2>
              <span style={{ color: "var(--pv-muted)" }}>
                {dayLabel(next.session_date, today)}, {timeRange(next.offering)}
                {next.offering.location ? ` · ${next.offering.location}` : ""}
              </span>
            </div>
          </div>
        </section>
      )}

      <section className="pv-sec">
        <SectionHead
          title="This week at The ARK"
          sub="Classes, gatherings, and experiences. Members book in a tap."
          href="/portal/schedule"
          link="Full schedule"
        />
        {week.length ? (
          <WeekTabs days={weekDays} initial={today} />
        ) : (
          <div className="pv-empty">
            <h3>A quiet week here</h3>
            <p>Nothing on the calendar{city ? ` in ${city.name}` : ""} yet. Check back soon.</p>
          </div>
        )}
      </section>

      {expeditions.length > 0 && (
        <section className="pv-sec">
          <SectionHead title="Expeditions" sub="Further afield, together." href="/portal/explore?kind=expedition" />
          <div style={{ display: "grid", gap: 16 }}>
            {expeditions.map((o) => {
              const c = coverUrl(o.cover_path);
              const where = p.cities.find((x) => x.id === o.city_id)?.name;
              return (
                <EventLink key={o.id} className="pv-big" id={o.id}>
                  <div className="img" style={c ? { backgroundImage: `url(${c})` } : undefined} />
                  <div className="body">
                    <span className="pv-tag" style={{ alignSelf: "flex-start" }}>
                      {whenLabel(o)}
                    </span>
                    <h3>{o.title}</h3>
                    {o.description && <p>{o.description}</p>}
                    <span style={{ color: "var(--pv-muted)" }}>
                      {[where, o.location].filter(Boolean).join(" · ")}
                      {o.capacity ? ` · ${o.capacity} places` : ""}
                    </span>
                    <span className="pv-btn sm" style={{ alignSelf: "flex-start", marginTop: "auto" }}>
                      Find out more
                    </span>
                  </div>
                </EventLink>
              );
            })}
          </div>
        </section>
      )}

      <section className="pv-sec">
        <SectionHead
          title="Members"
          sub={
            people.length
              ? `${people.length} ${people.length === 1 ? "member is" : "members are"} in the directory.`
              : "No one is in the directory yet."
          }
          href="/portal/people"
        />
        {people.length > 0 && (
          <div className="pv-stack" style={{ marginBottom: 18 }}>
            {people.slice(0, 10).map((m) => (
              <Av key={m.id} id={m.id} name={m.name} photo={m.photo_path} />
            ))}
          </div>
        )}
        {suggested.length > 0 ? (
          <>
            <h3 style={{ fontSize: 20, margin: "8px 0 12px" }}>People you might like to meet</h3>
            <div className="pv-grid">
              {suggested.map((s) => (
                <PersonCard key={s.p.id} p={s.p} why={reason(s)} meName={me?.name} />
              ))}
            </div>
          </>
        ) : (
          me && !(me.interests.length || me.cities.length) && (
            <p style={{ color: "var(--pv-muted)", margin: 0 }}>
              <Link href="/portal/me" style={{ color: "var(--pv-sea)" }}>Add your interests and cities</Link> and
              we’ll suggest people who share them.
            </p>
          )
        )}
      </section>
    </>
  );
}
