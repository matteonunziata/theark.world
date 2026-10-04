"use client";

import { useTransition } from "react";
import { ConfirmButton, Drawer, useDrawer } from "@/components/drawer";
import { useToast } from "@/components/toast";
import type { Tables } from "@/lib/database.types";
import { COLORS, colorVar } from "@/lib/roles";
import { addSuggestedDivisions, saveDivision } from "../actions";

type Division = Tables<"divisions">;
type Person = Pick<Tables<"team_members">, "id" | "name" | "division_id" | "status">;

export function DivisionsView({
  divisions,
  team,
  canEdit,
}: {
  divisions: Division[];
  team: Person[];
  canEdit: boolean;
}) {
  const drawer = useDrawer<Division>();
  const toast = useToast();
  const [pending, start] = useTransition();

  const suggest = () =>
    start(async () => {
      const r = await addSuggestedDivisions();
      toast(r.ok ? (r.message ?? "") : (r.error ?? ""));
    });

  return (
    <>
      {canEdit && divisions.length > 0 && (
        <div className="toolbar">
          <span className="count">
            {divisions.length} {divisions.length === 1 ? "division" : "divisions"}
          </span>
          <button type="button" className="btn primary" onClick={drawer.openNew}>
            Add division
          </button>
        </div>
      )}
      {!divisions.length ? (
        <div className="empty">
          <h2>No divisions yet</h2>
          <p>
            Start from a suggested set based on how The ARK runs, then rename or
            remove any of them.
          </p>
          {canEdit && (
            <>
              <button type="button" className="btn primary" onClick={suggest} disabled={pending}>
                Add suggested divisions
              </button>{" "}
              <button type="button" className="btn" onClick={drawer.openNew}>
                Add one yourself
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="cards">
          {divisions.map((d) => {
            const lead = team.find((m) => m.id === d.lead_id);
            const n = team.filter((m) => m.division_id === d.id).length;
            return (
              <button
                type="button"
                className="card"
                key={d.id}
                onClick={() => canEdit && drawer.openItem(d)}
                style={canEdit ? undefined : { cursor: "default" }}
              >
                <div className="top">
                  <span className="swatch" style={{ background: colorVar(d.color) }} />
                  <h3>{d.name}</h3>
                </div>
                <p>{d.description || "No description yet."}</p>
                <div className="meta">
                  <span>{lead ? `Led by ${lead.name}` : "No lead set"}</span>
                  <span>
                    {n} {n === 1 ? "person" : "people"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Drawer
        key={drawer.item?.id ?? "new"}
        title={drawer.item ? "Edit division" : "Add division"}
        open={drawer.open}
        onClose={drawer.close}
        action={saveDivision}
        footer={
          <>
            {drawer.item && <ConfirmButton label="Remove" />}
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={drawer.close}>
              Cancel
            </button>
            <button type="submit" className="btn primary">
              {drawer.item ? "Save changes" : "Add division"}
            </button>
          </>
        }
      >
        {drawer.item && <input type="hidden" name="id" value={drawer.item.id} />}
        <div className="fld">
          <label htmlFor="d-name">Division name</label>
          <input id="d-name" name="name" defaultValue={drawer.item?.name} placeholder="e.g. Memberships" required />
        </div>
        <div className="fld">
          <label htmlFor="d-desc">What it covers</label>
          <textarea id="d-desc" name="description" defaultValue={drawer.item?.description ?? ""} />
        </div>
        <div className="fld">
          <label htmlFor="d-lead">Lead</label>
          <select id="d-lead" name="lead_id" defaultValue={drawer.item?.lead_id ?? ""}>
            <option value="">No lead</option>
            {team
              .filter((m) => m.status !== "inactive")
              .map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
          </select>
        </div>
        <fieldset className="fld" style={{ border: 0, padding: 0 }}>
          <legend style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 6 }}>Color</legend>
          <div className="swatches">
            {COLORS.map((c) => (
              <label key={c}>
                <input
                  type="radio"
                  name="color"
                  value={c}
                  aria-label={c}
                  defaultChecked={(drawer.item?.color ?? "leaf") === c}
                />
                <span style={{ background: colorVar(c) }} />
              </label>
            ))}
          </div>
        </fieldset>
      </Drawer>
    </>
  );
}
