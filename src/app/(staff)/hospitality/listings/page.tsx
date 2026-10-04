import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { estatePhoto, lotTitle } from "@/lib/estate";
import { money } from "@/lib/schedule";
import { HospitalityHead } from "../hospitality-head";

export const metadata: Metadata = { title: "Listings" };

export default async function ListingsPage() {
  const { supabase } = await requireStaff("hospitality");
  const [{ data: lots }, { data: photos }] = await Promise.all([
    supabase
      .from("lots")
      .select("id, code, name, home_name, listing_title, listing_published, nightly_rate, rate_currency, max_guests, photo_path, bedrooms")
      .eq("in_hospitality", true)
      .order("code"),
    supabase.from("listing_photos").select("lot_id, path, position").order("position"),
  ]);
  const cover = new Map<string, string>();
  for (const p of photos ?? []) if (!cover.has(p.lot_id)) cover.set(p.lot_id, p.path);
  const listed = (lots ?? []).map((l) => ({ ...l, photo_path: cover.get(l.id) ?? l.photo_path }));

  return (
    <div className="page">
      <HospitalityHead />
      <div className="listings-h">
        <p className="muted" style={{ margin: 0 }}>
          {listed.length} home{listed.length === 1 ? "" : "s"} in the programme,{" "}
          {listed.filter((h) => h.listing_published).length} live on the booking site.
        </p>
        <span className="spacer" />
        <a className="btn sm" href="/stay" target="_blank" rel="noreferrer">Public booking site</a>
        <Link className="btn sm" href="/estate">Add a home</Link>
      </div>
      {!listed.length ? (
        <div className="empty">
          <h2>No homes in the programme yet</h2>
          <p>
            When an owner joins active stewardship, open their lot in Real estate
            and choose “Add to hospitality”. Their listing shows here.
          </p>
          <Link className="btn primary" href="/estate">Go to Real estate</Link>
        </div>
      ) : (
        <div className="lots">
          {listed.map((h) => {
            const photo = estatePhoto(h.photo_path);
            return (
              <Link key={h.id} href={`/hospitality/${h.id}`} className="lot-card">
                <div className="lot-img">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt="" loading="lazy" />
                  ) : (
                    <span>Lot {h.code}</span>
                  )}
                  <span className="lot-pill" style={{ ["--tone" as string]: h.listing_published ? "var(--leaf)" : "var(--slate)" }}>
                    {h.listing_published ? "Live" : "Draft"}
                  </span>
                </div>
                <div className="lot-body">
                  <b>{h.listing_title || h.home_name || lotTitle(h)}</b>
                  <span className="muted">
                    {[`Lot ${h.code}`, h.bedrooms !== null ? `${h.bedrooms} bedrooms` : null, h.max_guests ? `sleeps ${h.max_guests}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <span className="lot-foot">
                    {h.nightly_rate !== null ? `${money(h.nightly_rate, h.rate_currency)} a night` : "No rate yet"}
                    <span className="muted"> · edit listing</span>
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
