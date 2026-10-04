"use client";

import { CoverField } from "@/components/cover-field";
import { ConfirmButton, Drawer, useDrawer } from "@/components/drawer";
import { coverUrl } from "@/lib/covers";
import type { Tables } from "@/lib/database.types";
import { saveCity } from "../actions";

type City = Tables<"cities"> & { members: number; offerings: number };

export function CitiesView({ cities, canEdit }: { cities: City[]; canEdit: boolean }) {
  const d = useDrawer<City>();
  return (
    <>
      <div className="toolbar">
        <span className="muted">
          Where members are. Each city gets its own page in the members portal,
          with its experiences and the members who are there.
        </span>
        <span className="count" />
        {canEdit && (
          <button type="button" className="btn primary" onClick={d.openNew}>
            Add city
          </button>
        )}
      </div>
      <div className="cards">
        {cities.map((c) => (
          <button
            type="button"
            className="card city-card"
            key={c.id}
            onClick={() => canEdit && d.openItem(c)}
            style={canEdit ? undefined : { cursor: "default" }}
          >
            <div
              className="city-img"
              style={coverUrl(c.cover_path) ? { backgroundImage: `url(${coverUrl(c.cover_path)})` } : undefined}
            />
            <div className="top">
              <h3>{c.name}</h3>
              {c.is_home && <span className="tag">Home</span>}
              {!c.active && <span className="ptype">Hidden</span>}
            </div>
            <p>{c.blurb || c.country || "No description yet."}</p>
            <div className="meta">
              <span>{c.members} members here</span>
              <span>{c.offerings} on the calendar</span>
            </div>
          </button>
        ))}
      </div>
      <Drawer
        key={d.item?.id ?? "new"}
        title={d.item ? `Edit ${d.item.name}` : "Add city"}
        open={d.open}
        onClose={d.close}
        action={saveCity}
        footer={
          <>
            {d.item && !d.item.is_home && <ConfirmButton label="Remove" />}
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={d.close}>Cancel</button>
            <button type="submit" className="btn primary">{d.item ? "Save" : "Add city"}</button>
          </>
        }
      >
        {d.item && <input type="hidden" name="id" value={d.item.id} />}
        <div className="grid2">
          <div className="fld">
            <label htmlFor="ci-name">City</label>
            <input id="ci-name" name="name" defaultValue={d.item?.name} required placeholder="e.g. Nosara" />
          </div>
          <div className="fld">
            <label htmlFor="ci-country">Country</label>
            <input id="ci-country" name="country" defaultValue={d.item?.country ?? ""} />
          </div>
        </div>
        <div className="fld">
          <label htmlFor="ci-blurb">A line about it</label>
          <textarea id="ci-blurb" name="blurb" defaultValue={d.item?.blurb ?? ""} placeholder="What members find there" />
        </div>
        <div className="fld">
          <label htmlFor="ci-active">Show in the portal</label>
          <select id="ci-active" name="active" defaultValue={d.item?.active === false ? "no" : "yes"}>
            <option value="yes">Yes</option>
            <option value="no">Hidden</option>
          </select>
        </div>
        <div className="subhead">Cover photo</div>
        <CoverField initial={d.item?.cover_path} />
      </Drawer>
    </>
  );
}
