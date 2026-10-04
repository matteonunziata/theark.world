import type { Metadata } from "next";
import Link from "next/link";
import { PortalHead } from "@/components/portal-head";
import { getViewer } from "@/lib/auth";
import { coverUrl } from "@/lib/covers";
import { addDays, todayIn } from "@/lib/dates";
import { kindName, money, priceLabel, sessions, whenLabel } from "@/lib/schedule";
import { BookingPanel } from "./booking-panel";

type Props = PageProps<"/e/[id]/[[...date]]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const { supabase } = await getViewer();
  const { data } = await supabase.from("offerings").select("title, description").eq("id", id).maybeSingle();
  return data
    ? { title: data.title, description: data.description ?? undefined }
    : { title: "Event" };
}

export default async function EventPage({ params }: Props) {
  const { id, date } = await params;
  const { supabase, staff, memberId } = await getViewer();
  const [{ data: org }, { data: o }] = await Promise.all([
    supabase.rpc("public_org").maybeSingle(),
    supabase.from("offerings").select("*").eq("id", id).maybeSingle(),
  ]);
  const orgName = org?.name ?? "The ARK";
  const head = (
    <PortalHead
      name={orgName}
      sub="Classes and events"
      link={
        staff
          ? { href: "/events", label: "Staff view" }
          : memberId
            ? { href: "/portal", label: "Members portal" }
            : { href: "/portal/login", label: "Member sign-in" }
      }
    />
  );

  if (!o || o.status !== "published") {
    return (
      <>
        {head}
        <div className="p-body">
          <div className="empty">
            <h2>This isn’t available</h2>
            <p>
              It may have been removed, or it’s for members only.{" "}
              {!memberId && !staff && (
                <>
                  Members can <Link href={`/portal/login?next=/e/${id}`}>sign in</Link> to see it.
                </>
              )}
            </p>
          </div>
        </div>
      </>
    );
  }

  const today = todayIn(org?.timezone);
  const to = addDays(today, 120);
  const [{ data: tickets }, { data: cancels }, { data: counts }, { data: facs }] =
    await Promise.all([
      supabase.from("ticket_types").select("*").eq("offering_id", o.id).order("position"),
      supabase
        .from("session_cancellations")
        .select("offering_id, session_date")
        .eq("offering_id", o.id)
        .gte("session_date", today),
      supabase.rpc("session_counts", { p_offering_id: o.id, p_from: today, p_to: to }),
      supabase.rpc("facilitator_names"),
    ]);
  const upcoming = sessions([o], cancels ?? [], today, to).slice(0, 8);
  const f = (facs ?? []).find((x) => x.id === o.facilitator_id);
  const cover = coverUrl(o.cover_path);
  const canBook = !!memberId || (o.kind === "event" && o.access === "everyone");

  return (
    <>
      {head}
      <div className="p-body">
        <Link className="ev-back" href={memberId ? "/portal" : "/"}>
          ← {memberId ? "Full schedule" : orgName}
        </Link>
        <span className={`kind ${o.kind === "event" ? "event" : ""}`}>
          <i />
          {kindName(o.kind)}
          {o.access === "members" ? ", members only" : ""}
        </span>
        <h1 style={{ marginTop: 6 }}>{o.title}</h1>
        <p className="ev-meta">
          {whenLabel(o)}
          {o.location ? ` at ${o.location}` : ""}
          {f ? `, with ${f.name}` : ""}
        </p>
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="ev-cover" src={cover} alt="" />
        )}
        {o.description && <p className="ev-desc">{o.description}</p>}
        <div className="ev-grid">
          <BookingPanel
            offering={{
              id: o.id,
              title: o.title,
              start_time: o.start_time,
              end_time: o.end_time,
              location: o.location,
              capacity: o.capacity,
            }}
            sessions={upcoming.map((s) => ({ date: s.date, cancelled: s.cancelled }))}
            counts={counts ?? []}
            tickets={tickets ?? []}
            highlight={date?.[0] ?? null}
            today={today}
            isMember={!!memberId}
            canBook={canBook}
            loginHref={`/portal/login?next=/e/${o.id}`}
          />
          <aside style={{ display: "grid", gap: 14 }}>
            <section className="panel">
              <h2>Tickets</h2>
              {tickets?.length ? (
                tickets.map((t) => (
                  <div className="tk" key={t.id}>
                    <div>
                      <b>{t.name}</b>
                      {t.qty ? <span>{t.qty} per session</span> : null}
                    </div>
                    <div>{money(t.price, t.currency)}</div>
                  </div>
                ))
              ) : (
                <p className="muted" style={{ margin: 0 }}>{priceLabel(o, [])}</p>
              )}
              {o.access === "members" && tickets?.length ? (
                <p className="note" style={{ margin: "10px 0 0" }}>Members are included.</p>
              ) : null}
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}
