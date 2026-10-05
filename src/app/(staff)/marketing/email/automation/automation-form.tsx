"use client";

import { useActionState, useEffect, useTransition } from "react";
import { useToast } from "@/components/toast";
import type { ActionResult } from "@/lib/action-result";
import type { Tables } from "@/lib/database.types";
import { pct } from "@/lib/marketing";
import { runAutomationNow, saveAutomation, testAutomation } from "../../actions";

type Stat = { sent: number; opened: number; clicked: number };

export function AutomationForm({
  automation: a,
  welcome,
  followup,
  isAdmin,
}: {
  automation: Tables<"email_automations">;
  welcome: Stat;
  followup: Stat;
  isAdmin: boolean;
}) {
  const toast = useToast();
  const [state, save, saving] = useActionState(saveAutomation, { ok: false } as ActionResult);
  const [pending, start] = useTransition();
  useEffect(() => {
    if (state.ok && state.message) toast(state.message);
  }, [state, toast]);
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      const r = await fn();
      toast(r.ok ? (r.message ?? "") : (r.error ?? ""));
    });

  return (
    <form action={save} className="auto">
      {!state.ok && state.error && <div className="form-error" role="alert">{state.error}</div>}
      <section className="panel">
        <div className="panel-h">
          <div>
            <h2>{a.name}</h2>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              For people who join the waitlist through the signup page at /join. People added to the
              waitlist by hand in the CRM aren’t emailed.
            </p>
          </div>
          <label className="check">
            <input type="checkbox" name="active" defaultChecked={a.active} />
            On
          </label>
        </div>
        <ol className="auto-flow">
          <li><b>Joins the waitlist</b><span>Signup page, with where they came from</span></li>
          <li><b>Welcome email</b><span>Right away. {welcome.sent} sent, {pct(welcome.opened, welcome.sent)} opened</span></li>
          <li>
            <b>Application link</b>
            <span>
              After{" "}
              <input name="followup_days" type="number" min={0} max={60} defaultValue={a.followup_days} aria-label="Days to wait" className="days" />{" "}
              days. {followup.sent} sent, {pct(followup.clicked, followup.sent)} clicked
            </span>
          </li>
        </ol>
      </section>

      <section className="panel">
        <div className="panel-h">
          <h2>1. Welcome</h2>
          <button type="button" className="btn" disabled={pending} onClick={() => run(() => testAutomation("welcome"))}>Send me a test</button>
        </div>
        <div className="fld">
          <label htmlFor="a-ws">Subject</label>
          <input id="a-ws" name="welcome_subject" defaultValue={a.welcome_subject} />
        </div>
        <div className="fld">
          <label htmlFor="a-wb">Message</label>
          <textarea id="a-wb" name="welcome_body" rows={10} defaultValue={a.welcome_body} />
        </div>
      </section>

      <section className="panel">
        <div className="panel-h">
          <h2>2. Application link</h2>
          <button type="button" className="btn" disabled={pending} onClick={() => run(() => testAutomation("followup"))}>Send me a test</button>
        </div>
        <div className="fld">
          <label htmlFor="a-url">Application form link</label>
          <input id="a-url" name="application_url" type="url" defaultValue={a.application_url ?? ""} placeholder="https://…" />
          <span className="hint">Goes wherever {"{{application_url}}"} appears below, with UTM tags added.</span>
        </div>
        <div className="fld">
          <label htmlFor="a-fs">Subject</label>
          <input id="a-fs" name="followup_subject" defaultValue={a.followup_subject} />
        </div>
        <div className="fld">
          <label htmlFor="a-fb">Message</label>
          <textarea id="a-fb" name="followup_body" rows={10} defaultValue={a.followup_body} />
        </div>
      </section>

      <div className="camp-actions">
        {isAdmin && (
          <button type="button" className="btn ghost" disabled={pending} onClick={() => run(runAutomationNow)}>
            Send what’s due now
          </button>
        )}
        <span className="spacer" />
        <button type="submit" className="btn primary" disabled={saving}>{saving ? "Saving…" : "Save automation"}</button>
      </div>
    </form>
  );
}
