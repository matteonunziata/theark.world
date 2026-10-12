"use client";

import { useState } from "react";
import { Drawer, useDrawer } from "@/components/drawer";
import { MODULES, type ModuleKey, ROLES } from "@/lib/roles";
import { saveRoleAccess } from "../actions";

type Role = (typeof ROLES)[number];

export function AccessView({
  counts,
  saved,
  canEdit,
}: {
  counts: Record<string, number>;
  /** Modules saved per role; a role not listed uses the defaults. */
  saved: Record<string, string[]>;
  canEdit: boolean;
}) {
  const drawer = useDrawer<Role>();
  const [checked, setChecked] = useState<string[]>([]);
  const current = (r: Role) =>
    saved[r.key] ??
    MODULES.filter((m) => (m.roles as string[]).includes(r.key)).map(
      (m) => m.key,
    );
  const names = (r: Role) =>
    r.key === "admin"
      ? "Every page"
      : MODULES.filter((m) => current(r).includes(m.key))
          .map((m) => m.name)
          .join(", ") || "No pages";

  const r = drawer.item;
  return (
    <>
      <div className="roles">
        {ROLES.map((role) => {
          const n = counts[role.key] ?? 0;
          const editable = canEdit && role.key !== "admin";
          return (
            <div className="role" key={role.key}>
              <b>{role.name}</b>
              <span className="d muted">
                {role.desc}
                <br />
                Pages: {names(role)}
              </span>
              <span className="n">
                {n} {n === 1 ? "person" : "people"}
                {editable && (
                  <>
                    {" · "}
                    <button
                      type="button"
                      className="link"
                      onClick={() => {
                        setChecked(current(role));
                        drawer.openItem(role);
                      }}
                    >
                      Edit
                    </button>
                  </>
                )}
              </span>
            </div>
          );
        })}
      </div>
      <Drawer
        title={r ? `${r.name} access` : "Access"}
        open={drawer.open}
        onClose={drawer.close}
        action={saveRoleAccess}
        footer={
          <>
            <button type="submit" className="btn primary">
              Save
            </button>
            <button
              type="submit"
              name="intent"
              value="reset"
              className="btn"
              formNoValidate
            >
              Reset to default
            </button>
            <span className="spacer" />
            <button type="button" className="btn" onClick={drawer.close}>
              Cancel
            </button>
          </>
        }
      >
        {r && (
          <>
            <input type="hidden" name="role" value={r.key} />
            <p className="muted">
              Choose the pages {r.name} can open. Changes apply the next time
              they load a page.
            </p>
            {MODULES.map((m) => (
              <label key={m.key} className="check">
                <input
                  type="checkbox"
                  name="modules"
                  value={m.key}
                  checked={checked.includes(m.key)}
                  onChange={(e) =>
                    setChecked((c) =>
                      e.target.checked
                        ? [...c, m.key]
                        : c.filter((k) => k !== (m.key as ModuleKey)),
                    )
                  }
                />{" "}
                {m.name}
              </label>
            ))}
            <p className="hint">
              This sets which pages show up. What someone can read or change
              inside a page is still limited by the database.
            </p>
          </>
        )}
      </Drawer>
    </>
  );
}
