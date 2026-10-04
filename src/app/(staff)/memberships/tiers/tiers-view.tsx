"use client";

import { ConfirmButton, Drawer, useDrawer } from "@/components/drawer";
import type { Tables } from "@/lib/database.types";
import { tierClass, tierPrice } from "@/lib/crm";
import { saveDiscount, saveTier } from "../actions";

type Tier = Tables<"membership_tiers">;
type Discount = Tables<"discounts">;

export function TiersView({
  tiers,
  discounts,
  counts,
  discountUse,
  canEdit,
}: {
  tiers: Tier[];
  discounts: Discount[];
  counts: Record<string, number>;
  discountUse: Record<string, number>;
  canEdit: boolean;
}) {
  const tier = useDrawer<Tier>();
  const disc = useDrawer<Discount>();
  return (
    <>
      <div className="toolbar">
        <span className="muted">What each membership costs and includes.</span>
        <span className="count" />
        {canEdit && (
          <button type="button" className="btn primary" onClick={tier.openNew}>
            Add tier
          </button>
        )}
      </div>
      <div className="cards">
        {tiers.map((t) => {
          const n = counts[t.key] ?? 0;
          return (
            <button
              type="button"
              className="card tier-card"
              key={t.key}
              onClick={() => canEdit && tier.openItem(t)}
              style={canEdit ? undefined : { cursor: "default" }}
            >
              <div className="top">
                <span className={`tier ${tierClass(t.key)}`}>{t.name}</span>
                {!t.active && <span className="ptype">Not offered</span>}
              </div>
              <h3>{tierPrice(t)}</h3>
              <p>{t.description || "No description yet."}</p>
              {t.perks.length > 0 && (
                <ul className="perks">
                  {t.perks.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
              {t.spots ? (
                <>
                  <div className="meter" aria-hidden="true">
                    <span style={{ width: `${Math.min(100, (n / t.spots) * 100)}%` }} />
                  </div>
                  <div className="meta">
                    <span>
                      {n} of {t.spots} spots taken
                    </span>
                    <span>{Math.max(0, t.spots - n)} left</span>
                  </div>
                </>
              ) : (
                <div className="meta">
                  <span>
                    {n} active {n === 1 ? "member" : "members"}
                  </span>
                </div>
              )}
            </button>
          );
        })}
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
        <div className="grid2">
          <div className="fld">
            <label htmlFor="tr-price">Price</label>
            <input id="tr-price" name="price" type="number" min={0} step="any" defaultValue={tier.item?.price ?? ""} placeholder="Not set" />
          </div>
          <div className="fld">
            <label htmlFor="tr-cur">Currency</label>
            <select id="tr-cur" name="currency" defaultValue={tier.item?.currency ?? "CRC"}>
              <option value="CRC">₡ CRC</option>
              <option value="USD">$ USD</option>
            </select>
          </div>
        </div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="tr-per">Billed</label>
            <select id="tr-per" name="period" defaultValue={tier.item?.period ?? "month"}>
              <option value="month">Monthly</option>
              <option value="year">Yearly</option>
              <option value="week">Weekly</option>
              <option value="day">Daily</option>
              <option value="once">Once</option>
            </select>
          </div>
          <div className="fld">
            <label htmlFor="tr-spots">Spots</label>
            <input id="tr-spots" name="spots" type="number" min={1} defaultValue={tier.item?.spots ?? ""} placeholder="No limit" />
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
