"use client";

import { CoverField } from "@/components/cover-field";
import type { Tables } from "@/lib/database.types";
import { byCode, HOME_STATUS, LOT_KINDS, LOT_STATUS } from "@/lib/estate";

type Lot = Tables<"lots">;

/** The lot form, shared by "Add a lot" and "Edit lot". */
export function LotFields({
  lot,
  people,
  lots = [],
}: {
  lot?: Lot | null;
  people: { id: string; name: string }[];
  lots?: { id: string; code: string; name: string | null; estate_lot_id: string | null }[];
}) {
  const estates = lots.filter((l) => l.id !== lot?.id && !l.estate_lot_id).sort(byCode);
  return (
    <>
      {lot && <input type="hidden" name="id" value={lot.id} />}
      <div className="grid2">
        <div className="fld">
          <label htmlFor="l-code">Lot number</label>
          <input id="l-code" name="code" required defaultValue={lot?.code ?? ""} placeholder="e.g. A-12" />
        </div>
        <div className="fld">
          <label htmlFor="l-name">Name</label>
          <input id="l-name" name="name" defaultValue={lot?.name ?? ""} placeholder="Optional, e.g. Casa Higuerón" />
        </div>
      </div>
      <div className="grid2">
        <div className="fld">
          <label htmlFor="l-status">Status</label>
          <select id="l-status" name="status" defaultValue={lot?.status ?? "available"}>
            {LOT_STATUS.map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
        </div>
        <div className="fld">
          <label htmlFor="l-zone">Zone or phase</label>
          <input id="l-zone" name="zone" defaultValue={lot?.zone ?? ""} placeholder="e.g. Ridge, Phase 1" />
        </div>
      </div>
      <div className="grid2">
        <div className="fld">
          <label htmlFor="l-kind">Type</label>
          <select id="l-kind" name="kind" defaultValue={lot?.kind ?? "lot"}>
            {LOT_KINDS.map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
        </div>
        <div className="fld">
          <label htmlFor="l-features">Specifications</label>
          <input id="l-features" name="features" defaultValue={lot?.features ?? ""} placeholder="e.g. Ocean Horizon & Jungle" />
        </div>
      </div>
      {estates.length > 0 && (
        <div className="fld">
          <label htmlFor="l-estate">Sold together with</label>
          <select id="l-estate" name="estate_lot_id" defaultValue={lot?.estate_lot_id ?? ""}>
            <option value="">On its own</option>
            {estates.map((e) => (
              <option key={e.id} value={e.id}>{e.name ? `${e.name} (Lot ${e.code})` : `Lot ${e.code}`}</option>
            ))}
          </select>
          <small className="muted">For estates made of several lots. Price the estate on its main lot.</small>
        </div>
      )}
      <div className="grid2">
        <div className="fld">
          <label htmlFor="l-size">Size (m²)</label>
          <input id="l-size" name="size_m2" inputMode="decimal" defaultValue={lot?.size_m2 ?? ""} />
        </div>
        <div className="fld">
          <label htmlFor="l-price">Price (shown while not sold)</label>
          <div style={{ display: "flex", gap: 6 }}>
            <input id="l-price" name="price" inputMode="decimal" defaultValue={lot?.price ?? ""} style={{ flex: 1 }} />
            <select name="currency" aria-label="Currency" defaultValue={lot?.currency ?? "USD"} style={{ width: 84 }}>
              <option>USD</option>
              <option>CRC</option>
            </select>
          </div>
        </div>
      </div>
      <div className="fld">
        <label htmlFor="l-owner">Owner</label>
        <select id="l-owner" name="owner_contact_id" defaultValue={lot?.owner_contact_id ?? ""}>
          <option value="">No owner yet</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <small className="muted">Owners come from the CRM. Add them there first if they’re missing.</small>
      </div>
      <div className="grid2">
        <div className="fld">
          <span className="lbl">Photo of the lot or home</span>
          <CoverField name="photo_path" bucket="estate" initial={lot?.photo_path} />
        </div>
        <div className="fld">
          <span className="lbl">Aerial view</span>
          <CoverField name="aerial_path" bucket="estate" initial={lot?.aerial_path} />
        </div>
      </div>
      <div className="fld">
        <label htmlFor="l-desc">About the lot</label>
        <textarea id="l-desc" name="description" rows={3} defaultValue={lot?.description ?? ""} placeholder="Views, trees, access, water, anything worth knowing" />
      </div>

      <div className="subhead">The home</div>
      <div className="grid2">
        <div className="fld">
          <label htmlFor="l-hs">Home</label>
          <select id="l-hs" name="home_status" defaultValue={lot?.home_status ?? "none"}>
            {HOME_STATUS.map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
        </div>
        <div className="fld">
          <label htmlFor="l-hn">Home name</label>
          <input id="l-hn" name="home_name" defaultValue={lot?.home_name ?? ""} placeholder="Optional" />
        </div>
      </div>
      <div className="grid2" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        <div className="fld">
          <label htmlFor="l-bed">Bedrooms</label>
          <input id="l-bed" name="bedrooms" type="number" min={0} defaultValue={lot?.bedrooms ?? ""} />
        </div>
        <div className="fld">
          <label htmlFor="l-bath">Bathrooms</label>
          <input id="l-bath" name="bathrooms" type="number" min={0} step={0.5} defaultValue={lot?.bathrooms ?? ""} />
        </div>
        <div className="fld">
          <label htmlFor="l-built">Built (m²)</label>
          <input id="l-built" name="built_m2" inputMode="decimal" defaultValue={lot?.built_m2 ?? ""} />
        </div>
      </div>
      <div className="fld">
        <label htmlFor="l-hnotes">About the home</label>
        <textarea id="l-hnotes" name="home_notes" rows={3} defaultValue={lot?.home_notes ?? ""} placeholder="Architect, materials, pool, solar, anything the team should know" />
      </div>
    </>
  );
}
