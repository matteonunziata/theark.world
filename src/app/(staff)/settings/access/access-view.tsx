"use client";

import { useActionState, useEffect, useEffectEvent, useState } from "react";
import { useToast } from "@/components/toast";
import type { ActionResult } from "@/lib/action-result";
import { MODULES, ROLES } from "@/lib/roles";
import { resetRoleAccess, saveAccessMatrix } from "../actions";

const defaults = (role: string) =>
  MODULES.filter((m) => (m.roles as string[]).includes(role)).map((m) => m.key);

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
  const toast = useToast();
  const initial = () =>
    Object.fromEntries(
      ROLES.map((r) => [r.key, saved[r.key] ?? defaults(r.key)]),
    ) as Record<string, string[]>;
  const [sel, setSel] = useState(initial);
  const [state, action, pending] = useActionState(saveAccessMatrix, {
    ok: false,
  } as ActionResult);
  const onSaved = useEffectEvent((m: string) => toast(m));
  useEffect(() => {
    if (state.ok && state.message) onSaved(state.message);
  }, [state]);

  const toggle = (role: string, mod: string, on: boolean) =>
    setSel((s) => ({
      ...s,
      [role]: on ? [...s[role], mod] : s[role].filter((k) => k !== mod),
    }));

  return (
    <form action={action}>
      {!state.ok && state.error && (
        <div className="form-error" role="alert">
          {state.error}
        </div>
      )}
      <div className="table-wrap">
        <table className="lines-table">
          <thead>
            <tr>
              <th>Access level</th>
              {MODULES.map((m) => (
                <th key={m.key} style={{ textAlign: "center" }}>
                  {m.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROLES.map((r) => {
              const n = counts[r.key] ?? 0;
              const admin = r.key === "admin";
              return (
                <tr key={r.key}>
                  <td>
                    <b>{r.name}</b>
                    <div className="muted">
                      {r.desc} · {n} {n === 1 ? "person" : "people"}
                    </div>
                  </td>
                  {MODULES.map((m) => (
                    <td key={m.key} style={{ textAlign: "center" }}>
                      <input
                        type="checkbox"
                        name={`${r.key}:${m.key}`}
                        aria-label={`${r.name}: ${m.name}`}
                        checked={admin || sel[r.key].includes(m.key)}
                        disabled={admin || !canEdit}
                        onChange={(e) => toggle(r.key, m.key, e.target.checked)}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {canEdit && (
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button type="submit" className="btn primary" disabled={pending}>
            Save access
          </button>
          <button
            type="button"
            className="btn"
            disabled={pending}
            onClick={async () => {
              await resetRoleAccess();
              setSel(
                Object.fromEntries(
                  ROLES.map((r) => [r.key, defaults(r.key)]),
                ) as Record<string, string[]>,
              );
              toast("Back to the default pages");
            }}
          >
            Reset all to default
          </button>
        </div>
      )}
    </form>
  );
}
