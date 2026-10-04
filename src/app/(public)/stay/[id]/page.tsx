import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/logo";
import { getViewer } from "@/lib/auth";
import { estatePhoto, hourLabel } from "@/lib/estate";
import { BookingCard, type Listing } from "./booking-card";

type Props = PageProps<"/stay/[id]">;
const UUID = /^[0-9a-f-]{36}$/;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

async function load(id: string) {
  if (!UUID.test(id)) return null;
  const { supabase } = await getViewer();
  const { data } = await supabase.rpc("public_listing", { p_id: id });
  return (data as Listing | null) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const l = await load((await params).id);
  return l
    ? { title: { absolute: `${l.title} · Stay at The ARK` }, description: l.summary ?? undefined }
    : { title: { absolute: "Stay at The ARK" } };
}

export default async function StayHome({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const l = await load(id);
  if (!l) notFound();
  const photos = l.photos.length ? l.photos : l.fallback_photo ? [{ path: l.fallback_photo, caption: null }] : [];
  const back = new URLSearchParams(
    Object.entries({ in: sp.in, out: sp.out, guests: sp.guests }).filter(([, v]) => typeof v === "string") as [string, string][],
  ).toString();

  return (
    <main className="stay">
      <header className="stay-top">
        <Link href="/stay" aria-label="The ARK stays">
          <Logo tone="dark" height={30} />
        </Link>
        <Link href={`/stay${back ? `?${back}` : ""}`} className="stay-back">← All homes</Link>
      </header>

      <h1 className="stay-title">{l.title}</h1>
      <p className="stay-sub">
        {[l.zone, "Santa Teresa, Costa Rica"].filter(Boolean).join(" · ")}
      </p>

      {photos.length > 0 && (
        <div className={`stay-gallery n${Math.min(photos.length, 5)}`}>
          {photos.slice(0, 5).map((p, i) => (
            <a key={p.path} href={estatePhoto(p.path)!} target="_blank" rel="noreferrer" className={i === 0 ? "main" : ""}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={estatePhoto(p.path)!} alt={p.caption ?? ""} />
            </a>
          ))}
        </div>
      )}

      <div className="stay-layout">
        <div className="stay-info">
          <p className="stay-facts">
            {[
              l.max_guests ? `${l.max_guests} guests` : null,
              l.bedrooms !== null ? `${l.bedrooms} bedroom${l.bedrooms === 1 ? "" : "s"}` : null,
              l.beds !== null ? `${l.beds} bed${l.beds === 1 ? "" : "s"}` : null,
              l.bathrooms !== null ? `${Number(l.bathrooms)} bath${Number(l.bathrooms) === 1 ? "" : "s"}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {l.summary && <p className="stay-summary">{l.summary}</p>}

          {l.amenities.length > 0 && (
            <section>
              <h2>What’s here</h2>
              <ul className="stay-amen">
                {l.amenities.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2>Good to know</h2>
            <dl className="stay-kv">
              <dt>Check-in</dt>
              <dd>From {hourLabel(l.check_in_time)}</dd>
              <dt>Check-out</dt>
              <dd>By {hourLabel(l.check_out_time)}</dd>
              {l.min_nights > 1 && (
                <>
                  <dt>Minimum stay</dt>
                  <dd>{l.min_nights} nights</dd>
                </>
              )}
            </dl>
            {l.house_rules && <p className="stay-rules">{l.house_rules}</p>}
          </section>

          {photos.length > 5 && (
            <section>
              <h2>More photos</h2>
              <div className="stay-more">
                {photos.slice(5).map((p) => (
                  <a key={p.path} href={estatePhoto(p.path)!} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={estatePhoto(p.path)!} alt={p.caption ?? ""} loading="lazy" />
                  </a>
                ))}
              </div>
            </section>
          )}
        </div>

        <BookingCard
          l={l}
          initial={{
            checkIn: typeof sp.in === "string" && ISO.test(sp.in) ? sp.in : "",
            checkOut: typeof sp.out === "string" && ISO.test(sp.out) ? sp.out : "",
            guests: Math.max(1, Number(sp.guests) || 1),
          }}
        />
      </div>
      <footer className="stay-foot">The ARK · Santa Teresa, Costa Rica</footer>
    </main>
  );
}
