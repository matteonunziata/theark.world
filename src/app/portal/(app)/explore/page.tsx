import type { Metadata } from "next";
import Link from "next/link";
import { addDays, dayLabel, todayIn } from "@/lib/dates";
import { loadPortal } from "@/lib/portal";
import { KINDS, priceLabel, sessions } from "@/lib/schedule";
import { SessionCard } from "../../ui";

export const metadata: Metadata = { title: "Explore" };

export default async function Explore({ searchParams }: PageProps<"/portal/explore">) {
  const { kind, where } = await searchParams;
  const k = typeof kind === "string" && KINDS.some(([x]) => x === kind) ? kind : "";
  const everywhere = where === "all";
  const p = await loadPortal();
  const today = todayIn(p.timezone);
  const [offerings, tickets, cancels, facs] = await Promise.all([
    p.supabase.from("offerings").select("*").eq("status", "published"),
    p.supabase.from("ticket_types").select("*"),
    p.supabase.from("session_cancellations").select("offering_id, session_date").gte("session_date", today),
    p.supabase.rpc("facilitator_names"),
  ]);
  const list = sessions(
    (offerings.data ?? []).filter(
      (o) => everywhere || !p.city || !o.city_id || o.city_id === p.city.id,
    ),
    cancels.data ?? [],
    today,
    addDays(today, 45),
    { published: true, kind: k },
  );
  const dates = [...new Set(list.map((s) => s.date))];
  const fac = (id: string | null) => (facs.data ?? []).find((f) => f.id === id)?.name;
  const href = (next: { kind?: string; where?: string }) => {
    const q = new URLSearchParams();
    const kk = next.kind ?? k;
    const ww = next.where ?? (everywhere ? "all" : "");
    if (kk) q.set("kind", kk);
    if (ww) q.set("where", ww);
    return `/portal/explore${q.size ? `?${q}` : ""}`;
  };

  return (
    <>
      <div className="pv-sec-h" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="pv-h1">Explore</h1>
          <p>
            {everywhere ? "Everywhere The ARK gathers." : `What’s on in ${p.city?.name ?? "the club"}.`}
          </p>
        </div>
      </div>
      <div className="pv-pills" role="group" aria-label="What">
        <Link className="pv-pill" href={href({ kind: "" })} aria-current={!k ? "page" : undefined}>
          Everything
        </Link>
        {KINDS.map(([v, l]) => (
          <Link key={v} className="pv-pill" href={href({ kind: v })} aria-current={k === v ? "page" : undefined}>
            {l === "Class" ? "Classes" : `${l}s`}
          </Link>
        ))}
        {p.cities.length > 1 && (
          <Link className="pv-pill" href={href({ where: everywhere ? "" : "all" })} aria-current={everywhere ? "page" : undefined} style={{ marginLeft: "auto" }}>
            {everywhere ? "Showing all cities" : "All cities"}
          </Link>
        )}
      </div>
      {!list.length ? (
        <div className="pv-empty">
          <h3>Nothing here yet</h3>
          <p>New classes, experiences, and expeditions show up as soon as they’re published.</p>
        </div>
      ) : (
        dates.map((d) => (
          <section className="pv-day" key={d}>
            <h3>{dayLabel(d, today)}</h3>
            <div className="pv-grid">
              {list
                .filter((s) => s.date === d)
                .map((s) => (
                  <SessionCard
                    key={`${s.o.id}-${d}`}
                    o={s.o}
                    date={d}
                    today={today}
                    cancelled={s.cancelled}
                    facilitator={fac(s.o.facilitator_id)}
                    price={priceLabel(s.o, tickets.data ?? [])}
                  />
                ))}
            </div>
          </section>
        ))
      )}
    </>
  );
}
