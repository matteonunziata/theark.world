import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { reason, suggestions } from "@/lib/connect";
import { coverUrl } from "@/lib/covers";
import { addDays, dayLabel, fmtDate, timeRange, todayIn } from "@/lib/dates";
import { loadPortal } from "@/lib/portal";
import { priceLabel, sessions, whenLabel } from "@/lib/schedule";
import { Av, PersonCard, SectionHead, SessionCard } from "../ui";

export const metadata: Metadata = { title: "Members portal" };

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

  const [offerings, tickets, cancels, facs, dir, feed, myRegs, myPosts, mySent] = await Promise.all([
    supabase.from("offerings").select("*").eq("status", "published"),
    supabase.from("ticket_types").select("*"),
    supabase.from("session_cancellations").select("offering_id, session_date").gte("session_date", today),
    supabase.rpc("facilitator_names"),
    supabase.rpc("member_directory"),
    supabase.rpc("feed", { p_limit: 20 }),
    me
      ? supabase
          .from("registrations")
          .select("id, session_date, qr_token, offering:offerings(title, start_time, end_time, location)")
          .or(`user_id.eq.${p.user!.id},contact_id.eq.${me.id}`)
          .order("session_date")
      : Promise.resolve({ data: [] as never[] }),
    me
      ? supabase.from("posts").select("id", { count: "exact", head: true }).eq("author_contact_id", me.id)
      : Promise.resolve({ count: 0 }),
    me
      ? supabase.from("messages").select("id", { count: "exact", head: true }).eq("sender_id", me.id)
      : Promise.resolve({ count: 0 }),
  ]);

  const all = offerings.data ?? [];
  const fac = (id: string | null) => (facs.data ?? []).find((f) => f.id === id)?.name;
  const inCity = all.filter((o) => !city || o.city_id === city.id || !o.city_id);
  const week = sessions(inCity.filter((o) => o.kind !== "expedition"), cancels.data ?? [], today, addDays(today, 7), {
    published: true,
  }).slice(0, 12);
  const expeditions = all
    .filter((o) => o.kind === "expedition" && (o.end_date ?? o.start_date) >= today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, 2);
  const people = dir.data ?? [];
  const here = people.filter((x) => !x.is_me && city && x.city_id === city.id);
  const suggested = suggestions(people, me, city?.id ?? null, 3);
  const posts = (feed.data ?? []).filter((x) => !x.parent_id).slice(0, 3);
  const upcoming = (myRegs.data ?? []).filter((r) => r.session_date >= today && r.offering);
  const next = upcoming[0];
  const cover = coverUrl(city?.cover_path);
  const first = (me?.name ?? p.staff?.name ?? "").split(/\s+/)[0];

  const steps = me
    ? [
        { done: !!me.bio && me.interests.length > 0, t: "Tell people a little about you", href: "/portal/me" },
        { done: !!me.city_id, t: "Choose the city you’re in", href: "/portal/me" },
        { done: (myRegs.data ?? []).length > 0, t: "Book your first class or experience", href: "/portal/explore" },
        { done: (myPosts.count ?? 0) > 0, t: "Introduce yourself in the feed", href: "/portal/feed" },
        { done: (mySent.count ?? 0) > 0, t: "Say hello to someone you’d like to meet", href: "/portal/people" },
      ]
    : [];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <>
      <section className={`pv-hero ${cover ? "has-img" : ""}`} style={cover ? { backgroundImage: `url(${cover})` } : undefined}>
        {!cover && <Logo kind="mark" height={420} className="mark" />}
        <span className="eyebrow">
          {city ? `${city.name}${city.country ? `, ${city.country}` : ""}` : p.orgName}
        </span>
        <h1>
          {greeting(p.timezone)}
          {first ? `, ${first}` : ""}.
        </h1>
        <p>
          {city?.blurb ??
            "Here’s what’s happening this week, who’s around, and where we’re headed next."}
        </p>
        <div className="cta">
          <Link className="pv-btn light" href="/portal/explore">
            See what’s on
          </Link>
          <Link className="pv-btn ghost" href="/portal/people">
            Who’s here
          </Link>
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
            <Link className="pv-btn" href={`/t/${next.qr_token}`}>
              Your ticket
            </Link>
          </div>
        </section>
      )}

      {steps.length > 0 && doneCount < steps.length && (
        <section className="pv-sec">
          <div className="pv-panel">
            <h2>Settling in</h2>
            <div className="pv-progress" aria-hidden="true">
              <span style={{ width: `${(doneCount / steps.length) * 100}%` }} />
            </div>
            <ul className="pv-check">
              {steps.map((s) => (
                <li key={s.t} className={s.done ? "done" : ""}>
                  <span className="box">{s.done ? "✓" : ""}</span>
                  <span className="t">{s.t}</span>
                  {!s.done && <Link href={s.href}>Do it</Link>}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="pv-sec">
        <SectionHead
          title={`This week${city ? ` in ${city.name}` : ""}`}
          sub="Classes, gatherings, and experiences. Members book in a tap."
          href="/portal/explore"
        />
        {week.length ? (
          <div className="pv-rail">
            {week.map((s) => (
              <SessionCard
                key={`${s.o.id}-${s.date}`}
                o={s.o}
                date={s.date}
                today={today}
                cancelled={s.cancelled}
                facilitator={fac(s.o.facilitator_id)}
                price={priceLabel(s.o, tickets.data ?? [])}
              />
            ))}
          </div>
        ) : (
          <div className="pv-empty">
            <h3>A quiet week here</h3>
            <p>Nothing on the calendar{city ? ` in ${city.name}` : ""} yet. Try another city, or check back soon.</p>
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
                <Link key={o.id} className="pv-big" href={`/e/${o.id}`}>
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
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="pv-sec">
        <SectionHead
          title={city ? `Members in ${city.name}` : "Members"}
          sub={
            here.length
              ? `${here.length} ${here.length === 1 ? "member is" : "members are"} here now.`
              : "No one has said they’re here yet."
          }
          href="/portal/people"
        />
        {here.length > 0 && (
          <div className="pv-stack" style={{ marginBottom: 18 }}>
            {here.slice(0, 10).map((m) => (
              <Av key={m.id} id={m.id} name={m.name} />
            ))}
          </div>
        )}
        {suggested.length > 0 && (
          <>
            <h3 style={{ fontSize: 20, margin: "8px 0 12px" }}>People you might like to meet</h3>
            <div className="pv-grid">
              {suggested.map((s) => (
                <PersonCard
                  key={s.p.id}
                  p={s.p}
                  cityName={p.cities.find((c) => c.id === s.p.city_id)?.name}
                  why={reason(s, city?.name)}
                  shared={s.shared}
                  canMessage={!!me}
                />
              ))}
            </div>
          </>
        )}
      </section>

      <section className="pv-sec">
        <SectionHead title="From the community" sub="Plans, finds, and invitations." href="/portal/feed" link="Open the feed" />
        <div className="pv-panel">
          {posts.length ? (
            posts.map((x) => (
              <div className="pv-post" key={x.id}>
                <div className="who">
                  <Av id={x.author_contact_id ?? x.id} name={x.author_name} size="sm" />
                  <div>
                    <b>{x.author_name}</b>{" "}
                    <span>{fmtDate(x.created_at.slice(0, 10), { month: "short", day: "numeric" })}</span>
                  </div>
                </div>
                <p className="text">{x.body}</p>
              </div>
            ))
          ) : (
            <p style={{ margin: 0, color: "var(--pv-muted)" }}>
              Nothing yet. <Link href="/portal/feed">Be the first to say hello.</Link>
            </p>
          )}
        </div>
      </section>
    </>
  );
}
