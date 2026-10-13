"use client";

import Link from "next/link";
import { type ReactNode, useActionState, useEffect, useTransition } from "react";
import { useToast } from "@/components/toast";
import type { ActionResult } from "@/lib/action-result";
import type { Database, Tables } from "@/lib/database.types";
import { fmtDate } from "@/lib/dates";
import {
  area,
  estatePhoto,
  HOME_STATUS,
  label,
  lotTitle,
  RELATIONS,
} from "@/lib/estate";
import { eligibleOn, monthsActive } from "@/lib/steward";
import { deactivateMyself, saveMyHousehold } from "./actions";

type Prop = Database["public"]["Functions"]["my_properties"]["Returns"][number];

/** A form that runs a server action and reports the result in a toast. */
export function Form({
  action,
  children,
  submit,
  reset,
}: {
  action: (prev: ActionResult, data: FormData) => Promise<ActionResult>;
  children: ReactNode;
  submit: string;
  /** Clear the fields after a successful save (for "add" forms). */
  reset?: boolean;
}) {
  const toast = useToast();
  const [state, run, pending] = useActionState(action, { ok: false } as ActionResult);
  useEffect(() => {
    if (state.ok && state.message) toast(state.message);
    if (!state.ok && state.error) toast(state.error);
  }, [state, toast]);
  return (
    <form className="pv-form" action={run} key={reset && state.ok ? state.message : "f"}>
      {children}
      <div>
        <button type="submit" className="pv-btn sm" disabled={pending}>
          {pending ? "Saving…" : submit}
        </button>
      </div>
    </form>
  );
}

export const Fld = ({ id, text, children }: { id: string; text: string; children: ReactNode }) => (
  <div>
    <label htmlFor={id}>{text}</label>
    {children}
  </div>
);

export function PropertyView({
  lot,
  household,
  logs,
  today,
  steward,
  stewardName,
  pendingBudgets,
  charged,
  nextStay,
}: {
  lot: Prop;
  household: Tables<"lot_household">[];
  logs: Database["public"]["Functions"]["my_property_work"]["Returns"];
  today: string;
  steward: { status: string; active_since: string | null } | null;
  stewardName: string | null;
  pendingBudgets: number;
  charged: number;
  nextStay: string | null;
}) {
  const toast = useToast();
  const [busy, start] = useTransition();
  const photo = estatePhoto(lot.photo_path);
  const aerial = estatePhoto(lot.aerial_path);
  const open = logs.filter((l) => l.status !== "done");
  const homeLine = [
    lot.bedrooms !== null ? `${lot.bedrooms} bed` : null,
    lot.bathrooms !== null ? `${Number(lot.bathrooms)} bath` : null,
    area(lot.built_m2) ? `${area(lot.built_m2)} built` : null,
  ].filter(Boolean);
  const muted = { color: "var(--pv-muted)" };
  const summary = { cursor: "pointer", fontWeight: 600 } as const;

  return (
    <>
      <div className="pv-sec-h" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="pv-h1">{lotTitle(lot)}</h1>
          <p>
            {[lot.name ? `Lot ${lot.code}` : null, lot.zone, area(lot.size_m2)].filter(Boolean).join(" · ") ||
              "Your property at The ARK"}
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          ["Steward", stewardName ?? "—", null],
          ["Stewardship", steward?.status === "active" ? "Active" : "Not active", null],
          ["Open work", String(open.length), "maintenance"],
          ["Budgets to approve", String(pendingBudgets), "budgets"],
          ["Charged for work", `₡${Math.round(charged).toLocaleString("en-US")}`, "billing"],
          ...(lot.in_hospitality ? [["Next guests", nextStay ? fmtDate(nextStay, { month: "short", day: "numeric" }) : "None booked", "hospitality"]] : []),
        ].map(([t, v, tab]) => {
          const inner = (
            <>
              <div style={{ ...muted, fontSize: 13.5 }}>{t}</div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>{v}</div>
            </>
          );
          return tab ? (
            <Link key={t} className="pv-panel" style={{ padding: 16, color: "inherit", textDecoration: "none" }} href={`/steward?lot=${lot.id}&tab=${tab}`}>
              {inner}
            </Link>
          ) : (
            <div key={t} className="pv-panel" style={{ padding: 16 }}>
              {inner}
            </div>
          );
        })}
      </div>

      {(photo || aerial) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginBottom: 20 }}>
          {[photo, aerial].filter(Boolean).map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src as string} alt={lotTitle(lot)} style={{ width: "100%", height: 220, objectFit: "cover", borderRadius: 18 }} />
          ))}
        </div>
      )}

      <div className="pv-two">
        <div style={{ display: "grid", gap: 20 }}>
          <section className="pv-panel">
            <h2>Your lot</h2>
            <dl className="pv-kv" style={{ margin: 0 }}>
              <dt>Lot</dt>
              <dd>{lot.code}</dd>
              {lot.zone && (
                <>
                  <dt>Zone</dt>
                  <dd>{lot.zone}</dd>
                </>
              )}
              <dt>Size</dt>
              <dd>{area(lot.size_m2) ?? "—"}</dd>
              {lot.features && (
                <>
                  <dt>Specifications</dt>
                  <dd>{lot.features}</dd>
                </>
              )}
              <dt>Home</dt>
              <dd>
                {lot.home_status === "none"
                  ? "No home yet"
                  : [lot.home_name, label(HOME_STATUS, lot.home_status), ...homeLine].filter(Boolean).join(" · ")}
              </dd>
            </dl>
            {lot.description && <p style={{ whiteSpace: "pre-line", margin: "14px 0 0" }}>{lot.description}</p>}
            {lot.home_notes && <p style={{ whiteSpace: "pre-line", margin: "10px 0 0" }}>{lot.home_notes}</p>}
          </section>
        </div>

        <aside style={{ display: "grid", gap: 20 }}>
          {steward?.status === "active" && steward.active_since && (
            <section className="pv-panel">
              <h2>Active stewardship</h2>
              <p style={{ marginTop: 0 }}>
                <b>Month {monthsActive(steward.active_since, today)} of 48</b>
                <span style={muted}> · profit-share eligible {fmtDate(eligibleOn(steward.active_since, 48), { month: "long", year: "numeric" })}</span>
              </p>
              <button
                type="button"
                className="pv-btn ghost sm"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm("Step back from active stewardship? Your 48-month clock goes back to 0, and you start again from month 0 if you return.")) return;
                  start(async () => {
                    const r = await deactivateMyself();
                    toast(r.ok ? (r.message ?? "Done") : (r.error ?? "Couldn’t save"));
                  });
                }}
              >
                Step back from active stewardship
              </button>
            </section>
          )}

          <section className="pv-panel">
            <h2>Household</h2>
            {household.length === 0 && (
              <p style={{ ...muted, marginTop: 0 }}>
                No one listed yet. Add the family who live here, so the team knows who to expect.
              </p>
            )}
            {household.map((m) => (
              <details key={m.id} className="pv-post">
                <summary style={{ cursor: "pointer" }}>
                  <b>{m.name}</b>
                  <span style={muted}>
                    {" "}
                    · {label(RELATIONS, m.relation)}
                    {m.lives_on_site ? "" : " · not on site"}
                  </span>
                </summary>
                <MemberForm lotId={lot.id} m={m} />
              </details>
            ))}
            <details style={{ marginTop: 10 }}>
              <summary style={summary}>Add a person</summary>
              <MemberForm lotId={lot.id} first={household.length === 0} />
            </details>
          </section>
        </aside>
      </div>
    </>
  );
}

function MemberForm({ lotId, m, first }: { lotId: string; m?: Tables<"lot_household">; first?: boolean }) {
  const toast = useToast();
  const [busy, start] = useTransition();
  const p = m?.id ?? "new";
  return (
    <>
      <Form action={saveMyHousehold} submit={m ? "Save" : "Add"} reset={!m}>
        <input type="hidden" name="lot_id" value={lotId} />
        {m && <input type="hidden" name="id" value={m.id} />}
        <Fld id={`${p}-n`} text="Name">
          <input id={`${p}-n`} name="name" className="pv-input" required defaultValue={m?.name ?? ""} />
        </Fld>
        <Fld id={`${p}-r`} text="Relation">
          <select id={`${p}-r`} name="relation" className="pv-input" defaultValue={m?.relation ?? (first ? "owner" : "family")}>
            {RELATIONS.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Fld>
        <Fld id={`${p}-e`} text="Email">
          <input id={`${p}-e`} name="email" type="email" className="pv-input" defaultValue={m?.email ?? ""} />
        </Fld>
        <Fld id={`${p}-p`} text="Phone or WhatsApp">
          <input id={`${p}-p`} name="phone" type="tel" className="pv-input" defaultValue={m?.phone ?? ""} />
        </Fld>
        <Fld id={`${p}-y`} text="Year born">
          <input id={`${p}-y`} name="birth_year" type="number" min={1900} max={2100} className="pv-input" defaultValue={m?.birth_year ?? ""} placeholder="Optional" />
        </Fld>
        <label className="pv-switch">
          <input type="checkbox" name="lives_on_site" defaultChecked={m?.lives_on_site ?? true} />
          <span>Lives on site</span>
        </label>
        <Fld id={`${p}-o`} text="Notes">
          <textarea id={`${p}-o`} name="notes" className="pv-input" rows={2} defaultValue={m?.notes ?? ""} placeholder="Allergies, pets, anything the team should know" />
        </Fld>
      </Form>
      {m && (
        <button
          type="button"
          className="pv-btn ghost sm"
          style={{ marginTop: 8 }}
          disabled={busy}
          onClick={() =>
            start(async () => {
              const fd = new FormData();
              fd.set("intent", "delete");
              fd.set("id", m.id);
              fd.set("lot_id", lotId);
              const r = await saveMyHousehold({ ok: false }, fd);
              toast(r.ok ? (r.message ?? "Removed") : (r.error ?? "Couldn’t remove"));
            })
          }
        >
          Remove
        </button>
      )}
    </>
  );
}
