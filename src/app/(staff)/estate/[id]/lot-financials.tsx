"use client";

import { useState, useTransition } from "react";
import { ConfirmButton, Drawer, useDrawer } from "@/components/drawer";
import { useToast } from "@/components/toast";
import type { Tables } from "@/lib/database.types";
import { fmtDate } from "@/lib/dates";
import { overdueDays } from "@/lib/finance";
import { fmtMoney } from "@/lib/shop";
import { FileField, openFile } from "../../finance/entry-drawer";
import { savePropertyEntry, setPropertyEntryStatus } from "../actions";

type Entry = Tables<"finance_entries">;
type Steward = { id: string; name: string };

const OWED = ["HOA fee", "Maintenance", "Other service"];
const PAYOUT = ["Hospitality payout"];

const crc = (n: number) => fmtMoney(n, "CRC");

function statusOf(e: Entry, today: string) {
  if (e.status === "draft") return { text: "Draft", cls: "" };
  if (e.status === "paid") return { text: "Paid", cls: "" };
  const late = overdueDays(e.due_date, today);
  return late !== null && late > 0 ? { text: `Overdue, ${late} days`, cls: "out" } : { text: "Sent", cls: "low" };
}

/** What the steward owes The ARK, what The ARK owes them, and the balance. Colones only. */
export function LotFinancials({
  lotId,
  entries,
  stewards,
  primaryId,
  today,
}: {
  lotId: string;
  entries: Entry[];
  stewards: Steward[];
  primaryId: string | null;
  today: string;
}) {
  const toast = useToast();
  const [busy, start] = useTransition();
  const drawer = useDrawer<Entry>();
  const [kind, setKind] = useState<"income" | "expense">("income");
  const [status, setStatus] = useState("unpaid");
  const nameOf = (id: string | null) => stewards.find((s) => s.id === id)?.name ?? "—";

  const owedToArk = entries.filter((e) => e.kind === "income");
  const owedToSteward = entries.filter((e) => e.kind === "expense");
  const open = (list: Entry[]) => list.filter((e) => e.status === "unpaid");
  const sum = (list: Entry[]) => list.reduce((a, e) => a + Number(e.amount), 0);
  const arkOpen = sum(open(owedToArk));
  const stewardOpen = sum(open(owedToSteward));
  const net = arkOpen - stewardOpen;
  const overdue = open(owedToArk).filter((e) => (overdueDays(e.due_date, today) ?? 0) > 0);

  const act = (id: string, to: "unpaid" | "paid") =>
    start(async () => {
      const r = await setPropertyEntryStatus(id, to);
      toast(r.ok ? (r.message ?? "Saved") : (r.error ?? "Couldn’t save"));
    });
  const add = (k: "income" | "expense") => {
    setKind(k);
    setStatus(k === "income" ? "unpaid" : "unpaid");
    drawer.openNew();
  };
  const edit = (e: Entry) => {
    setKind(e.kind as "income" | "expense");
    setStatus(e.status);
    drawer.openItem(e);
  };

  const e = drawer.item;
  const income = kind === "income";

  const rows = (list: Entry[], payout: boolean) =>
    list.length === 0 ? (
      <p className="muted" style={{ margin: 0 }}>
        {payout ? "No payouts yet." : "No invoices yet."}
      </p>
    ) : (
      <div className="table-wrap" style={{ margin: 0 }}>
        <table className="lines-table">
          <thead>
            <tr>
              <th>{payout ? "Period" : "Invoice"}</th>
              <th>Steward</th>
              <th>{payout ? "Paid / due" : "Due"}</th>
              <th>Amount</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((x) => {
              const st = statusOf(x, today);
              return (
                <tr key={x.id}>
                  <td>
                    <button type="button" className="linkish" onClick={() => edit(x)}>
                      {payout
                        ? x.period_start && x.period_end
                          ? `${fmtDate(x.period_start)} – ${fmtDate(x.period_end)}`
                          : fmtDate(x.entry_date)
                        : `${x.reference ? `#${x.reference}` : "No number"} · ${fmtDate(x.entry_date)}`}
                    </button>
                    <span className="muted" style={{ display: "block", fontSize: 12.5 }}>{x.category ?? ""}</span>
                  </td>
                  <td>{nameOf(x.contact_id)}</td>
                  <td>{x.status === "paid" ? (x.paid_on ? fmtDate(x.paid_on) : "—") : x.due_date ? fmtDate(x.due_date) : "—"}</td>
                  <td>{crc(Number(x.amount))}</td>
                  <td>{st.cls ? <span className={`tag-sm ${st.cls}`}>{st.text}</span> : st.text}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {x.file_path && (
                      <button type="button" className="btn ghost sm" onClick={() => openFile(x.file_path!)}>View</button>
                    )}{" "}
                    {x.status === "draft" && (
                      <button type="button" className="btn sm" disabled={busy} onClick={() => act(x.id, "unpaid")}>Send</button>
                    )}
                    {x.status === "unpaid" && (
                      <button type="button" className="btn sm" disabled={busy} onClick={() => act(x.id, "paid")}>
                        {payout ? "Mark paid" : "Received"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section className="panel">
        <h2>Balance</h2>
        <dl className="kv">
          <dt>Owed to The ARK</dt>
          <dd>{crc(arkOpen)}{overdue.length > 0 && <span className="tag-sm out" style={{ marginLeft: 8 }}>{overdue.length} overdue</span>}</dd>
          <dt>Owed to the steward</dt>
          <dd>{crc(stewardOpen)}</dd>
          <dt>Net</dt>
          <dd>
            <b>{crc(Math.abs(net))}</b>
            <span className="muted"> {net > 0 ? "owed by the steward" : net < 0 ? "owed to the steward" : "settled"}</span>
          </dd>
          {stewards.length > 1 &&
            stewards.map((s) => {
              const a = sum(open(owedToArk).filter((x) => x.contact_id === s.id));
              const b = sum(open(owedToSteward).filter((x) => x.contact_id === s.id));
              return (
                <div key={s.id} style={{ display: "contents" }}>
                  <dt>{s.name}</dt>
                  <dd className="muted">owes {crc(a)} · is owed {crc(b)}</dd>
                </div>
              );
            })}
        </dl>
      </section>

      <section className="panel">
        <h2>
          Owed to The ARK
          <button type="button" className="btn primary sm" onClick={() => add("income")}>New invoice</button>
        </h2>
        {rows(owedToArk, false)}
      </section>

      <section className="panel">
        <h2>
          Owed to the steward
          <button type="button" className="btn primary sm" onClick={() => add("expense")}>New payout</button>
        </h2>
        {rows(owedToSteward, true)}
      </section>

      <Drawer
        key={e?.id ?? `new-${kind}`}
        title={`${e ? "Edit" : "New"} ${income ? "invoice" : "payout"}`}
        open={drawer.open}
        onClose={drawer.close}
        action={savePropertyEntry}
        footer={
          <>
            {e && <ConfirmButton />}
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={drawer.close}>Cancel</button>
            <button type="submit" className="btn primary">Save</button>
          </>
        }
      >
        <input type="hidden" name="lot_id" value={lotId} />
        <input type="hidden" name="kind" value={kind} />
        {e && <input type="hidden" name="id" value={e.id} />}
        <div className="fld">
          <label htmlFor="pe-steward">Steward</label>
          <select id="pe-steward" name="contact_id" required defaultValue={e?.contact_id ?? primaryId ?? stewards[0]?.id ?? ""}>
            {stewards.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="pe-amount">Amount (₡ colones)</label>
            <input id="pe-amount" name="amount" type="number" min={0} step="any" required defaultValue={e?.amount ?? ""} />
          </div>
          <div className="fld">
            <label htmlFor="pe-cat">Category</label>
            <input id="pe-cat" name="category" list="pe-cats" defaultValue={e?.category ?? (income ? "HOA fee" : "Hospitality payout")} />
            <datalist id="pe-cats">
              {(income ? OWED : PAYOUT).map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
        </div>
        {!income && (
          <div className="grid2">
            <div className="fld">
              <label htmlFor="pe-from">Period from</label>
              <input id="pe-from" name="period_start" type="date" defaultValue={e?.period_start ?? ""} />
            </div>
            <div className="fld">
              <label htmlFor="pe-to">Period to</label>
              <input id="pe-to" name="period_end" type="date" defaultValue={e?.period_end ?? ""} />
            </div>
          </div>
        )}
        <div className="grid2">
          <div className="fld">
            <label htmlFor="pe-date">{income ? "Invoice date" : "Statement date"}</label>
            <input id="pe-date" name="entry_date" type="date" required defaultValue={e?.entry_date ?? today} />
          </div>
          <div className="fld">
            <label htmlFor="pe-ref">{income ? "Invoice number" : "Reference"}</label>
            <input id="pe-ref" name="reference" defaultValue={e?.reference ?? ""} />
          </div>
        </div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="pe-status">Status</label>
            <select id="pe-status" name="status" value={status} onChange={(ev) => setStatus(ev.target.value)}>
              <option value="draft">Draft (not owed yet)</option>
              <option value="unpaid">{income ? "Sent, unpaid" : "Owed, unpaid"}</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          {status === "unpaid" && (
            <div className="fld">
              <label htmlFor="pe-due">Due</label>
              <input id="pe-due" name="due_date" type="date" defaultValue={e?.due_date ?? ""} required={income} />
            </div>
          )}
        </div>
        <div className="fld">
          <label htmlFor="pe-desc">Description</label>
          <input id="pe-desc" name="description" defaultValue={e?.description ?? ""} placeholder={income ? "e.g. HOA fee, October" : "e.g. Hospitality, September"} />
        </div>
        <div className="subhead">{income ? "Invoice (PDF)" : "Statement"}</div>
        <FileField path={e?.file_path} name={e?.file_name} />
      </Drawer>
    </div>
  );
}
