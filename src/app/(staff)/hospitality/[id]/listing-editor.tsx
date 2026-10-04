"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useEffectEvent, useState, useTransition } from "react";
import { resizeImage } from "@/components/cover-field";
import { useDrawer } from "@/components/drawer";
import { useToast } from "@/components/toast";
import type { ActionResult } from "@/lib/action-result";
import type { Tables } from "@/lib/database.types";
import { addDays, addMonths, fmtDate, monthLabel } from "@/lib/dates";
import { AMENITIES, coversNight, estatePhoto, label, lotTitle, monthGrid, nights, STAY_KINDS } from "@/lib/estate";
import { money } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/client";
import { addListingPhotos, blockNights, saveListing, setPublished, unblock, updateListingPhoto } from "../../estate/actions";
import { type Stay, StayDrawer } from "../stay-drawer";

type Lot = Tables<"lots">;
type Photo = Tables<"listing_photos">;

export function ListingEditor({ lot, photos, stays, today }: { lot: Lot; photos: Photo[]; stays: Stay[]; today: string }) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (p: Promise<ActionResult>) =>
    start(async () => {
      const r = await p;
      if (r.ok && r.message) toast(r.message);
      if (!r.ok) toast(r.error ?? "Couldn’t save");
      router.refresh();
    });
  const title = lot.listing_title || lot.home_name || lotTitle(lot);

  return (
    <>
      <p style={{ margin: "0 0 14px" }}>
        <Link href="/hospitality" className="muted">← Hospitality</Link>
      </p>
      <div className="lot-head">
        <div>
          <h1>{title}</h1>
          <p className="lede" style={{ margin: "4px 0 0" }}>
            Lot {lot.code}
            {lot.zone ? ` · ${lot.zone}` : ""}
            <span className={`lot-pill inline ${lot.listing_published ? "hosp" : ""}`} style={lot.listing_published ? undefined : { ["--tone" as string]: "var(--slate)" }}>
              {lot.listing_published ? "Live on the website" : "Not published"}
            </span>
          </p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap", alignSelf: "flex-start" }}>
          <Link className="btn" href={`/estate/${lot.id}`}>Lot page</Link>
          {lot.listing_published && (
            <a className="btn" href={`/stay/${lot.id}`} target="_blank" rel="noreferrer">View as a guest</a>
          )}
          <button
            type="button"
            className={`btn ${lot.listing_published ? "" : "primary"}`}
            disabled={pending}
            onClick={() => run(setPublished(lot.id, !lot.listing_published))}
          >
            {lot.listing_published ? "Unpublish" : "Publish"}
          </button>
        </div>
      </div>

      {!lot.in_hospitality && (
        <div className="alert" style={{ marginBottom: 16 }}>
          This home isn’t in the hospitality programme. Turn it on from the <Link href={`/estate/${lot.id}`}>lot page</Link> before publishing.
        </div>
      )}

      <Photos lot={lot} photos={photos} run={run} pending={pending} />

      <div className="listing-grid">
        <Details lot={lot} />
        <Availability lot={lot} stays={stays} today={today} run={run} pending={pending} />
      </div>
    </>
  );
}

function Photos({
  lot,
  photos,
  run,
  pending,
}: {
  lot: Lot;
  photos: Photo[];
  run: (p: Promise<ActionResult>) => void;
  pending: boolean;
}) {
  const toast = useToast();
  const [uploading, setUploading] = useState(0);

  async function upload(files: FileList) {
    const list = [...files].slice(0, 20);
    setUploading(list.length);
    const paths: string[] = [];
    for (const f of list) {
      try {
        const blob = await resizeImage(f, 2000);
        const path = `listing/${crypto.randomUUID()}.jpg`;
        const { error } = await createClient().storage.from("estate").upload(path, blob, { contentType: "image/jpeg" });
        if (error) throw error;
        paths.push(path);
      } catch {
        toast(`Couldn’t upload ${f.name}`);
      }
      setUploading((n) => n - 1);
    }
    if (paths.length) run(addListingPhotos(lot.id, paths));
  }

  return (
    <section className="panel" style={{ marginBottom: 16 }}>
      <h2>
        Photos
        <label className="btn primary sm" style={{ cursor: "pointer" }}>
          {uploading ? `Uploading ${uploading}…` : "Add photos"}
          <input type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files?.length && upload(e.target.files)} />
        </label>
      </h2>
      {!photos.length ? (
        <p className="muted" style={{ margin: 0 }}>
          No photos yet. Add a few: the outside, the main room, bedrooms, the view. The first photo is the cover on the website.
          {lot.photo_path ? " Until then the lot photo is used." : ""}
        </p>
      ) : (
        <div className="lphotos">
          {photos.map((p, i) => (
            <figure key={p.id} className={i === 0 ? "cover" : ""}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={estatePhoto(p.path)!} alt={p.caption ?? ""} loading="lazy" />
              {i === 0 && <span className="lphoto-tag">Cover</span>}
              <figcaption>
                <input
                  defaultValue={p.caption ?? ""}
                  placeholder="Caption"
                  aria-label="Caption"
                  onBlur={(e) => e.target.value !== (p.caption ?? "") && run(updateListingPhoto(lot.id, p.id, { caption: e.target.value }))}
                />
                <span>
                  <button type="button" disabled={pending || i === 0} onClick={() => run(updateListingPhoto(lot.id, p.id, { move: -1 }))} aria-label="Move earlier">←</button>
                  <button type="button" disabled={pending || i === photos.length - 1} onClick={() => run(updateListingPhoto(lot.id, p.id, { move: 1 }))} aria-label="Move later">→</button>
                  <button type="button" disabled={pending} onClick={() => confirm("Remove this photo?") && run(updateListingPhoto(lot.id, p.id, { remove: true }))} aria-label="Remove">✕</button>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}

function Details({ lot }: { lot: Lot }) {
  const toast = useToast();
  const router = useRouter();
  const [state, action, pending] = useActionState(saveListing, { ok: false } as ActionResult);
  const onResult = useEffectEvent((r: ActionResult) => {
    if (r.ok && r.message) {
      toast(r.message);
      router.refresh();
    } else if (r.error) toast(r.error);
  });
  useEffect(() => onResult(state), [state]);
  const custom = lot.amenities.filter((a) => !AMENITIES.includes(a));

  return (
    <form action={action} className="panel listing-form">
      <h2>
        The listing
        <button type="submit" className="btn primary sm" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
      </h2>
      <input type="hidden" name="id" value={lot.id} />
      <div className="fld">
        <label htmlFor="ls-title">Title guests see</label>
        <input id="ls-title" name="listing_title" defaultValue={lot.listing_title ?? ""} placeholder={lot.home_name ?? `Lot ${lot.code}`} />
      </div>
      <div className="fld">
        <label htmlFor="ls-sum">Description</label>
        <textarea id="ls-sum" name="listing_summary" rows={5} defaultValue={lot.listing_summary ?? ""} placeholder="What it’s like to stay here: the light, the sounds, the walk to the beach, the club." />
      </div>
      <div className="grid2" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="fld">
          <label htmlFor="ls-guests">Sleeps</label>
          <input id="ls-guests" name="max_guests" type="number" min={1} defaultValue={lot.max_guests ?? ""} />
        </div>
        <div className="fld">
          <label htmlFor="ls-bed">Bedrooms</label>
          <input id="ls-bed" name="bedrooms" type="number" min={0} defaultValue={lot.bedrooms ?? ""} />
        </div>
        <div className="fld">
          <label htmlFor="ls-beds">Beds</label>
          <input id="ls-beds" name="beds" type="number" min={0} defaultValue={lot.beds ?? ""} />
        </div>
        <div className="fld">
          <label htmlFor="ls-bath">Bathrooms</label>
          <input id="ls-bath" name="bathrooms" type="number" min={0} step={0.5} defaultValue={lot.bathrooms ?? ""} />
        </div>
      </div>
      <div className="grid2" style={{ gridTemplateColumns: "1.4fr 1fr 1fr" }}>
        <div className="fld">
          <label htmlFor="ls-rate">Nightly rate</label>
          <div style={{ display: "flex", gap: 6 }}>
            <input id="ls-rate" name="nightly_rate" inputMode="decimal" defaultValue={lot.nightly_rate ?? ""} style={{ flex: 1 }} />
            <select name="rate_currency" aria-label="Currency" defaultValue={lot.rate_currency} style={{ width: 80 }}>
              <option>USD</option>
              <option>CRC</option>
            </select>
          </div>
        </div>
        <div className="fld">
          <label htmlFor="ls-clean">Cleaning fee</label>
          <input id="ls-clean" name="cleaning_fee" inputMode="decimal" defaultValue={lot.cleaning_fee ?? ""} />
        </div>
        <div className="fld">
          <label htmlFor="ls-min">Minimum nights</label>
          <input id="ls-min" name="min_nights" type="number" min={1} defaultValue={lot.min_nights} />
        </div>
      </div>
      <div className="grid2">
        <div className="fld">
          <label htmlFor="ls-in">Check-in from</label>
          <input id="ls-in" name="check_in_time" type="time" defaultValue={lot.check_in_time.slice(0, 5)} />
        </div>
        <div className="fld">
          <label htmlFor="ls-out">Check-out by</label>
          <input id="ls-out" name="check_out_time" type="time" defaultValue={lot.check_out_time.slice(0, 5)} />
        </div>
      </div>
      <div className="fld">
        <span className="lbl">What’s there</span>
        <div className="amen">
          {AMENITIES.map((a) => (
            <label key={a} className="check">
              <input type="checkbox" name="amenity" value={a} defaultChecked={lot.amenities.includes(a)} />
              {a}
            </label>
          ))}
        </div>
        <input name="amenities_other" defaultValue={custom.join(", ")} placeholder="Anything else, separated by commas" style={{ marginTop: 8 }} />
      </div>
      <div className="fld">
        <label htmlFor="ls-rules">House rules</label>
        <textarea id="ls-rules" name="house_rules" rows={4} defaultValue={lot.house_rules ?? ""} placeholder="Quiet after 10pm. No parties. Shoes off inside. Owner’s studio stays locked." />
      </div>
      <div className="fld">
        <label htmlFor="ls-notes">Notes for the team (never shown to guests)</label>
        <textarea id="ls-notes" name="listing_notes" rows={3} defaultValue={lot.listing_notes ?? ""} />
      </div>
    </form>
  );
}

function Availability({
  lot,
  stays,
  today,
  run,
  pending,
}: {
  lot: Lot;
  stays: Stay[];
  today: string;
  run: (p: Promise<ActionResult>) => void;
  pending: boolean;
}) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const drawer = useDrawer<Stay>();
  const grid = monthGrid(`${month}-01`);
  const confirmed = stays.filter((s) => s.status === "confirmed");
  const at = (d: string) => confirmed.find((s) => coversNight(s, d));
  const inquiryAt = (d: string) => stays.find((s) => s.status === "inquiry" && coversNight(s, d));
  const sel = from && to ? { check_in: from, check_out: addDays(to, 1) } : from ? { check_in: from, check_out: addDays(from, 1) } : null;
  const clash = sel ? confirmed.some((s) => s.check_in < sel.check_out && sel.check_in < s.check_out) : false;
  const upcoming = stays.filter((s) => s.check_out >= today).slice(0, 8);

  const pick = (d: string) => {
    if (d < today) return;
    const s = at(d);
    if (s) {
      drawer.openItem(s);
      return;
    }
    if (!from || to || d < from) {
      setFrom(d);
      setTo(null);
    } else {
      setTo(d);
    }
  };

  return (
    <section className="panel">
      <h2>
        Availability
        <span className="weeknav" style={{ margin: 0 }}>
          <button type="button" className="btn sm" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month">←</button>
          <button type="button" className="btn sm" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month">→</button>
        </span>
      </h2>
      <p className="muted" style={{ fontSize: 13, margin: "-4px 0 10px" }}>
        {monthLabel(month)}. Tap a night, then another, to choose nights to block. Tap a booking to open it.
      </p>
      <div className="avcal">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className="avcal-dow">{d}</span>
        ))}
        {grid.days.map((d) => {
          const s = at(d);
          const inq = !s && inquiryAt(d);
          const chosen = sel && d >= sel.check_in && d < sel.check_out;
          return (
            <button
              key={d}
              type="button"
              className={[
                "avcal-d",
                d.slice(0, 7) !== month ? "out" : "",
                d < today ? "past" : "",
                d === today ? "today" : "",
                s ? `taken ${s.kind}` : "",
                inq ? "inq" : "",
                chosen ? "chosen" : "",
              ].join(" ")}
              onClick={() => pick(d)}
              title={s ? `${s.kind === "guest" ? s.guest_name : label(STAY_KINDS, s.kind)}` : inq ? `Inquiry: ${inq.guest_name}` : "Free"}
            >
              {Number(d.slice(8))}
            </button>
          );
        })}
      </div>
      <div className="tl-legend" style={{ marginTop: 8 }}>
        <span><i className="guest" /> Guest</span>
        <span><i className="owner" /> Owner</span>
        <span><i className="hold" /> Blocked</span>
        <span><i className="inquiry" /> Inquiry</span>
      </div>
      {sel && (
        <div className="avsel">
          <span>
            {fmtDate(sel.check_in)} – {fmtDate(sel.check_out)} · {nights(sel.check_in, sel.check_out)} night{nights(sel.check_in, sel.check_out) === 1 ? "" : "s"}
            {clash ? " · some nights are booked" : ""}
          </span>
          <button
            type="button"
            className="btn sm"
            disabled={pending || clash}
            onClick={() => {
              run(blockNights(lot.id, sel.check_in, sel.check_out, "Blocked"));
              setFrom(null);
              setTo(null);
            }}
          >
            Block
          </button>
          <button
            type="button"
            className="btn primary sm"
            disabled={clash}
            onClick={() => drawer.openNew()}
          >
            Book a stay
          </button>
          <button type="button" className="btn ghost sm" onClick={() => { setFrom(null); setTo(null); }}>Clear</button>
        </div>
      )}

      <h3 className="avh">Coming up</h3>
      {!upcoming.length ? (
        <p className="muted" style={{ fontSize: 13.5, margin: 0 }}>Nothing booked.</p>
      ) : (
        upcoming.map((s) => (
          <div key={s.id} className="stay-line static">
            <span className="d">{fmtDate(s.check_in)}</span>
            <button type="button" className="linkish-inline" onClick={() => drawer.openItem(s)}>
              <b>{s.kind === "guest" ? s.guest_name : label(STAY_KINDS, s.kind)}</b>
              <span className="muted">
                {" "}· {nights(s.check_in, s.check_out)} nights{s.status === "inquiry" ? " · inquiry" : ""}
                {s.total ? ` · ${money(s.total, s.currency)}` : ""}
              </span>
            </button>
            {s.kind === "hold" ? (
              <button type="button" className="btn ghost sm" disabled={pending} onClick={() => run(unblock(lot.id, s.id))}>Open up</button>
            ) : (
              <span />
            )}
          </div>
        ))
      )}

      <StayDrawer
        key={drawer.item?.id ?? `new-${sel?.check_in ?? ""}`}
        open={drawer.open}
        onClose={drawer.close}
        stay={drawer.item}
        homes={[lot]}
        defaults={{ lot_id: lot.id, check_in: sel?.check_in, check_out: sel?.check_out }}
      />
    </section>
  );
}
