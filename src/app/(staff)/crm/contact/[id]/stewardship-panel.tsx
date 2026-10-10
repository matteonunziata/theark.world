"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import type { ActionResult } from "@/lib/action-result";
import type { Tables } from "@/lib/database.types";
import { fmtDate } from "@/lib/dates";
import { eligibleOn, monthsActive, stewardStatusName } from "@/lib/steward";
import { createClient } from "@/lib/supabase/client";
import { changeStewardStatus, saveAgreement } from "../../../estate/stewards/actions";

type History = Tables<"steward_status_history"> & { by: string | null };

const open = async (path: string) => {
  const w = window.open("", "_blank");
  const { data } = await createClient().storage.from("stewardship").createSignedUrl(path, 60);
  if (data?.signedUrl && w) w.location.href = data.signedUrl;
  else w?.close();
};

/** Active stewardship on the CRM profile: status, agreement, the 48-month clock and history. */
export function StewardshipPanel({
  s,
  history,
  months,
  feesCurrent,
  feesOk,
  graceDays,
  isAdmin,
  today,
}: {
  s: Tables<"stewardships">;
  history: History[];
  months: number;
  feesCurrent: boolean;
  feesOk: boolean;
  graceDays: number;
  isAdmin: boolean;
  today: string;
}) {
  const toast = useToast();
  const [busy, start] = useTransition();
  const [reason, setReason] = useState("");
  const [asking, setAsking] = useState<null | "suspend" | "deactivate" | "unsuspend">(null);
  const done = monthsActive(s.active_since, today);
  const eligible = s.status === "active" && done >= months;
  const ready = s.status === "inactive" && !!s.agreement_signed_at && feesOk;

  const run = (change: "activate" | "deactivate" | "suspend" | "unsuspend") =>
    start(async () => {
      const r = await changeStewardStatus(s.contact_id, change, reason);
      toast(r.ok ? (r.message ?? "Saved") : (r.error ?? "Couldn’t save"));
      if (r.ok) {
        setAsking(null);
        setReason("");
      }
    });

  return (
    <section className="panel">
      <h2>
        Active stewardship
        <span className={`tag-sm ${s.status === "active" ? "" : s.status === "suspended" ? "out" : "low"}`} style={{ marginLeft: 8 }}>
          {stewardStatusName(s.status)}
        </span>
      </h2>

      {s.status === "active" && s.active_since ? (
        <>
          <p style={{ margin: "0 0 6px" }}>
            <b>Month {done} of {months}</b>
            <span className="muted"> · active since {fmtDate(s.active_since, { month: "long", day: "numeric", year: "numeric" })}</span>
          </p>
          <div style={{ height: 8, borderRadius: 99, background: "var(--line)", overflow: "hidden" }} role="progressbar" aria-valuemin={0} aria-valuemax={months} aria-valuenow={Math.min(done, months)}>
            <div style={{ width: `${Math.min(100, (done / months) * 100)}%`, height: "100%", background: "var(--leaf)" }} />
          </div>
          <p className="muted" style={{ fontSize: 13.5, margin: "6px 0 0" }}>
            {eligible
              ? "Profit-share eligible."
              : `Eligible for profit sharing on ${fmtDate(eligibleOn(s.active_since, months), { month: "long", day: "numeric", year: "numeric" })}.`}
          </p>
        </>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          {s.status === "suspended"
            ? "Suspended. The clock is at 0 and starts again from month 0 once they are active."
            : "The 48-month clock starts when they become active, and resets to 0 whenever they stop being active."}
          {s.status_reason ? ` Reason: ${s.status_reason}` : ""}
        </p>
      )}

      <dl className="kv" style={{ marginTop: 14 }}>
        <dt>Agreement</dt>
        <dd>
          {s.agreement_signed_at ? `Signed ${fmtDate(s.agreement_signed_at)}` : "Not signed"}
          {s.agreement_path && (
            <>
              {" · "}
              <button type="button" className="linkish" onClick={() => open(s.agreement_path!)}>View {s.agreement_name || "file"}</button>
            </>
          )}
        </dd>
        <dt>Fees</dt>
        <dd>
          {feesCurrent ? "Current" : feesOk ? `Late, inside the ${graceDays}-day grace period` : `More than ${graceDays} days overdue`}
        </dd>
      </dl>

      {isAdmin && (
        <>
          {ready && (
            <p style={{ margin: "10px 0" }}>
              <span className="tag-sm low">Ready to activate</span>
              <span className="muted" style={{ fontSize: 13.5 }}> Signed, and fees are current.</span>
            </p>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0" }}>
            {s.status === "inactive" && (
              <button type="button" className="btn primary sm" disabled={busy} onClick={() => run("activate")}>Activate</button>
            )}
            {s.status === "active" && (
              <button type="button" className="btn sm" disabled={busy} onClick={() => setAsking("deactivate")}>Deactivate</button>
            )}
            {s.status !== "suspended" && (
              <button type="button" className="btn danger sm" disabled={busy} onClick={() => setAsking("suspend")}>Suspend</button>
            )}
            {s.status === "suspended" && (
              <button type="button" className="btn sm" disabled={busy} onClick={() => setAsking("unsuspend")}>Lift suspension</button>
            )}
          </div>
          {asking && (
            <div className="fld">
              <label htmlFor="st-why">
                {asking === "suspend" ? "Which rule was broken? (required)" : "Reason (optional)"}
              </label>
              <input id="st-why" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button type="button" className="btn primary sm" disabled={busy || (asking === "suspend" && !reason.trim())} onClick={() => run(asking)}>
                  Confirm
                </button>
                <button type="button" className="btn ghost sm" onClick={() => setAsking(null)}>Cancel</button>
              </div>
            </div>
          )}
          <AgreementForm contactId={s.contact_id} s={s} today={today} />
        </>
      )}

      {history.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>History</summary>
          {history.map((h) => (
            <p key={h.id} style={{ margin: "8px 0 0", fontSize: 14 }}>
              {stewardStatusName(h.from_status)} → <b>{stewardStatusName(h.to_status)}</b>
              <span className="muted">
                {" "}· {fmtDate(h.created_at)} · {h.source === "system" ? "automatic" : h.source === "steward" ? "by the steward" : (h.by ?? "admin")}
                {h.reason ? ` · ${h.reason}` : ""}
              </span>
            </p>
          ))}
        </details>
      )}
    </section>
  );
}

function AgreementForm({ contactId, s, today }: { contactId: string; s: Tables<"stewardships">; today: string }) {
  const toast = useToast();
  const [state, action, pending] = useActionState(saveAgreement, { ok: false } as ActionResult);
  const [path, setPath] = useState(s.agreement_path ?? "");
  const [name, setName] = useState(s.agreement_name ?? "");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (state.ok && state.message) toast(state.message);
    if (!state.ok && state.error) toast(state.error);
  }, [state, toast]);

  async function upload(file: File) {
    if (file.size > 10 * 1024 * 1024) return toast("That file is over 10 MB.");
    setBusy(true);
    const p = `${contactId}/${crypto.randomUUID()}.${(file.name.split(".").pop() ?? "pdf").toLowerCase()}`;
    const { error } = await createClient().storage.from("stewardship").upload(p, file, { contentType: file.type || "application/pdf" });
    setBusy(false);
    if (error) return toast("Couldn’t upload that file.");
    setPath(p);
    setName(file.name);
  }

  return (
    <details>
      <summary style={{ cursor: "pointer", fontWeight: 600 }}>{s.agreement_signed_at ? "Update the agreement" : "Record the signed agreement"}</summary>
      <form action={action} className="fld" style={{ marginTop: 8, display: "grid", gap: 8 }}>
        <input type="hidden" name="contact_id" value={contactId} />
        <input type="hidden" name="file_path" value={path} />
        <input type="hidden" name="file_name" value={name} />
        <label htmlFor="ag-date">Date signed</label>
        <input id="ag-date" name="signed_at" type="date" max={today} defaultValue={s.agreement_signed_at ?? ""} />
        <label className="btn" style={{ cursor: "pointer", width: "fit-content" }}>
          {busy ? "Uploading…" : name ? `Replace ${name}` : "Attach the signed copy"}
          <input type="file" accept="application/pdf,image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" className="btn primary sm" disabled={pending || busy}>Save</button>
        </div>
        <span className="muted" style={{ fontSize: 13 }}>Leave the date empty and save to clear the agreement. If they are active, that makes them not active.</span>
      </form>
    </details>
  );
}
