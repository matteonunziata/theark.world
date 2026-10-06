"use client";

import { ConfirmButton, Drawer, useDrawer } from "@/components/drawer";
import type { Tables } from "@/lib/database.types";
import { PERIODS, tierClass, tierPrice } from "@/lib/crm";
import type { StripePrice } from "@/lib/stripe";
import { saveDiscount, saveTier } from "../actions";

type Tier = Tables<"membership_tiers">;
type Discount = Tables<"discounts">;

export function TiersView({
  tiers,
  discounts,
  counts,
  discountUse,
  canEdit,
  stripePrices,
}: {
  tiers: Tier[];
  discounts: Discount[];
  counts: Record<string, number>;
  discountUse: Record<string, number>;
  canEdit: boolean;
  stripePrices: StripePrice[];
}) {
  const tier = useDrawer<Tier>();
  const disc = useDrawer<Discount>();
  return (
    <>
      <div className="toolbar">
        <span className="muted">What each membership costs, at the rack rate and for friends &amp; family, and how many guests it brings.</span>
        <span className="count" />
        {canEdit && (
          <button type="button" className="btn primary" onClick={tier.openNew}>
            Add tier
          </button>
        )}
      </div>
      <div className="list">
        <div className="row head tier-row">
          <span>Tier</span>
          <span>Rack rate</span>
          <span className="t-ff">Friends &amp; family</span>
          <span className="t-guests">Guest passes</span>
          <span>Members</span>
        </div>
        {tiers.map((t) => {
          const n = counts[t.key] ?? 0;
          return (
            <button
              type="button"
              className="row tier-row"
              key={t.key}
              onClick={() => canEdit && tier.openItem(t)}
              style={canEdit ? undefined : { cursor: "default" }}
            >
              <span style={{ minWidth: 0 }}>
                <span className={`tier ${tierClass(t.key)}`}>{t.name}</span>
                {!t.active && <span className="ptype" style={{ marginLeft: 6 }}>Not offered</span>}
                {t.description && <span className="t-desc muted">{t.description}</span>}
              </span>
              <b style={{ fontWeight: 600 }}>{tierPrice(t)}</b>
              <span className="t-ff">{t.price_ff !== null ? tierPrice(t, null, "ff") : <span className="muted">—</span>}</span>
              <span className="t-guests">{t.guest_passes ? `${t.guest_passes} a month` : <span className="muted">None</span>}</span>
              <span className="muted">
                {t.spots ? `${n} of ${t.spots} spots` : `${n} active`}
              </span>
            </button>
          );
        })}
        {!tiers.length && (
          <div className="row static">
            <span className="muted">No tiers yet.</span>
          </div>
        )}
      </div>

      <h2 className="section-title" style={{ marginTop: 28 }}>
        Discounts
      </h2>
      <div className="list">
        {discounts.map((d) => (
          <button
            type="button"
            className="row qrow"
            key={d.id}
            onClick={() => canEdit && disc.openItem(d)}
            style={canEdit ? undefined : { cursor: "default" }}
          >
            <span className="who" style={{ display: "block" }}>
              <b>{d.name}</b>
              <span>{d.description}</span>
            </span>
            <span>
              <b>{Number(d.percent)}% off</b>
              {d.lifetime ? ", for life" : ""}
            </span>
            <span className="muted">
              {discountUse[d.id] ?? 0} {discountUse[d.id] === 1 ? "person" : "people"}
            </span>
            <span className={`status ${d.active ? "on" : "off"}`}>{d.active ? "Active" : "Off"}</span>
          </button>
        ))}
        {!discounts.length && (
          <div className="row static">
            <span className="muted">No discounts yet.</span>
          </div>
        )}
      </div>
      {canEdit && (
        <p className="note">
          <button type="button" className="btn" onClick={disc.openNew}>
            Add discount
          </button>{" "}
          Give someone a discount from their profile in the CRM.
        </p>
      )}

      <Drawer
        key={tier.item?.key ?? "new-tier"}
        title={tier.item ? `Edit ${tier.item.name}` : "Add tier"}
        open={tier.open}
        onClose={tier.close}
        action={saveTier}
        footer={
          <>
            {tier.item && <ConfirmButton label="Remove" />}
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={tier.close}>Cancel</button>
            <button type="submit" className="btn primary">{tier.item ? "Save tier" : "Add tier"}</button>
          </>
        }
      >
        {tier.item && <input type="hidden" name="key" value={tier.item.key} />}
        <div className="fld">
          <label htmlFor="tr-name">Name</label>
          <input id="tr-name" name="name" defaultValue={tier.item?.name} required />
        </div>
        <div className="grid2" style={{ gridTemplateColumns: "1fr 1fr 110px" }}>
          <div className="fld">
            <label htmlFor="tr-price">Rack rate</label>
            <input id="tr-price" name="price" type="number" min={0} step="any" defaultValue={tier.item?.price ?? ""} placeholder="Not set" />
          </div>
          <div className="fld">
            <label htmlFor="tr-ff">Friends &amp; family</label>
            <input id="tr-ff" name="price_ff" type="number" min={0} step="any" defaultValue={tier.item?.price_ff ?? ""} placeholder="Same as rack" />
          </div>
          <div className="fld">
            <label htmlFor="tr-cur">Currency</label>
            <select id="tr-cur" name="currency" defaultValue={tier.item?.currency ?? "CRC"}>
              <option value="CRC">₡ CRC</option>
              <option value="USD">$ USD</option>
            </select>
          </div>
        </div>
        <div className="fld">
          <label htmlFor="tr-stripe">Stripe product (day and week passes)</label>
          <select id="tr-stripe" name="stripe_price_id" defaultValue={tier.item?.stripe_price_id ?? ""}>
            <option value="">Find by the tier’s name</option>
            {stripePrices.map((sp) => (
              <option key={sp.priceId} value={sp.priceId}>
                {sp.name} · {sp.currency === "USD" ? "$" : "₡"}{sp.amount.toLocaleString("en-US")}
              </option>
            ))}
          </select>
        </div>
        <div className="grid2" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          <div className="fld">
            <label htmlFor="tr-per">Covers</label>
            <select id="tr-per" name="period" defaultValue={tier.item?.period ?? "month"}>
              {PERIODS.map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label htmlFor="tr-guests">Guest passes a month</label>
            <input id="tr-guests" name="guest_passes" type="number" min={0} defaultValue={tier.item?.guest_passes ?? 0} />
          </div>
          <div className="fld">
            <label htmlFor="tr-spots">Spots</label>
            <input id="tr-spots" name="spots" type="number" min={1} defaultValue={tier.item?.spots ?? ""} placeholder="No limit" />
          </div>
          <div className="fld">
            <label htmlFor="tr-court">Off court bookings (%)</label>
            <input id="tr-court" name="court_discount" type="number" min={0} max={100} step="any" defaultValue={tier.item?.court_discount ?? 0} />
            <span className="hint">Applied when members book a court. A higher personal discount still wins.</span>
          </div>
        </div>
        <div className="fld">
          <label htmlFor="tr-desc">Description</label>
          <input id="tr-desc" name="description" defaultValue={tier.item?.description ?? ""} />
        </div>
        <div className="fld">
          <label htmlFor="tr-perks">What’s included</label>
          <textarea id="tr-perks" name="perks" defaultValue={(tier.item?.perks ?? []).join("\n")} placeholder="One per line" />
        </div>
        <div className="fld">
          <label htmlFor="tr-pause">Pause rule</label>
          <input id="tr-pause" name="pause_rule" defaultValue={tier.item?.pause_rule ?? ""} />
        </div>
        <div className="fld">
          <label htmlFor="tr-active">Offered</label>
          <select id="tr-active" name="active" defaultValue={tier.item?.active === false ? "no" : "yes"}>
            <option value="yes">Yes</option>
            <option value="no">Not right now</option>
          </select>
        </div>
      </Drawer>

      <Drawer
        key={disc.item?.id ?? "new-discount"}
        title={disc.item ? "Edit discount" : "Add discount"}
        open={disc.open}
        onClose={disc.close}
        action={saveDiscount}
        footer={
          <>
            {disc.item && <ConfirmButton label="Remove" />}
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={disc.close}>Cancel</button>
            <button type="submit" className="btn primary">{disc.item ? "Save" : "Add discount"}</button>
          </>
        }
      >
        {disc.item && <input type="hidden" name="id" value={disc.item.id} />}
        <div className="fld">
          <label htmlFor="d-name2">Name</label>
          <input id="d-name2" name="name" defaultValue={disc.item?.name} required placeholder="e.g. Jungle Ventures" />
        </div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="d-pct">Percent off</label>
            <input id="d-pct" name="percent" type="number" min={1} max={100} step="any" defaultValue={disc.item?.percent ?? ""} required />
          </div>
          <div className="fld">
            <label htmlFor="d-life">How long</label>
            <select id="d-life" name="lifetime" defaultValue={disc.item?.lifetime ? "yes" : ""}>
              <option value="">While the membership lasts</option>
              <option value="yes">For life</option>
            </select>
          </div>
        </div>
        <div className="fld">
          <label htmlFor="d-desc2">Who it’s for</label>
          <input id="d-desc2" name="description" defaultValue={disc.item?.description ?? ""} />
        </div>
        <div className="fld">
          <label htmlFor="d-act">Status</label>
          <select id="d-act" name="active" defaultValue={disc.item?.active === false ? "no" : "yes"}>
            <option value="yes">Active</option>
            <option value="no">Off</option>
          </select>
        </div>
      </Drawer>
    </>
  );
}
