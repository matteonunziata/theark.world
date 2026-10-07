"use client";

import Link from "next/link";
import { Drawer, useDrawer } from "@/components/drawer";
import { fmtDate } from "@/lib/dates";
import {
  type BudgetLine,
  fmtStamp,
  type LineTotals,
  periodLabel,
  typeName,
  used,
} from "@/lib/budgets";
import type { Tables } from "@/lib/database.types";
import type { Conv } from "@/lib/finance";
import { payRequest, rejectRequest, reviewBudget } from "./actions";
import { FileField } from "./file-field";
import { type Account, AccountBox, Amt, Crc, FileButton } from "./parts";

type Req = Tables<"payment_requests"> & {
  budget: { id: string; name: string; division_id: string } | null;
  provider: { name: string } | null;
  line: { category: string; planned_crc: number } | null;
};

export function QueueView({
  budgets,
  lines,
  totals,
  requests,
  accounts,
  divisions,
  conv,
  today,
}: {
  budgets: Tables<"budgets">[];
  lines: Pick<BudgetLine, "id" | "budget_id" | "category" | "planned_crc">[];
  totals: LineTotals[];
  requests: Req[];
  accounts: Account[];
  divisions: { id: string; name: string }[];
  conv: Conv;
  today: string;
}) {
  const review = useDrawer<Tables<"budgets">>();
  const pay = useDrawer<Req>();
  const reject = useDrawer<Req>();
  const sector = (id: string | undefined) => divisions.find((d) => d.id === id)?.name ?? "";
  const plannedOf = (id: string) => lines.filter((l) => l.budget_id === id).reduce((s, l) => s + Number(l.planned_crc), 0);
  const lineCount = (id: string) => lines.filter((l) => l.budget_id === id).length;

  /** Would paying this (with what's already committed) take its line over plan? */
  const overBy = (r: Req) => {
    if (!r.line) return 0;
    const t = totals.find((x) => x.line_id === r.line_id);
    return used("project", t) - Number(r.line.planned_crc);
  };

  return (
    <>
      <h3 className="section-title">Budgets to approve ({budgets.length})</h3>
      {!budgets.length ? (
        <div className="empty"><p>Nothing waiting. Budgets sent for approval show up here, across every sector.</p></div>
      ) : (
        <div className="bp-rows">
          {budgets.map((b) => (
            <div key={b.id} className="bp-item">
              <div className="main">
                <b>{b.name}</b>
                <span className="meta">
                  {[sector(b.division_id), typeName(b.type), periodLabel(b), `${lineCount(b.id)} line${lineCount(b.id) === 1 ? "" : "s"}`, b.submitted_at ? `sent ${fmtStamp(b.submitted_at)}` : null].filter(Boolean).join(" · ")}
                </span>
              </div>
              <div className="side">
                <span className="amt"><Crc crc={plannedOf(b.id)} conv={conv} /></span>
                <span className="acts">
                  <Link className="btn sm" href={`/finance/budgets/${b.id}`}>Open</Link>
                  <button type="button" className="btn sm primary" onClick={() => review.openItem(b)}>Approve / reject</button>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <h3 className="section-title">Payments to make ({requests.length})</h3>
      {!requests.length ? (
        <div className="empty"><p>No payment requests waiting. Requests from Project budgets show up here.</p></div>
      ) : (
        <div className="bp-rows">
          {requests.map((r) => {
            const over = overBy(r);
            return (
              <div key={r.id} className="bp-item">
                <div className="main">
                  <b>{r.provider?.name ?? "Provider"}{r.milestone ? ` · ${r.milestone}` : ""}</b>
                  <span className="meta">
                    {[sector(r.budget?.division_id), r.budget?.name, r.line?.category, r.due_date ? `due ${fmtDate(r.due_date)}` : "no due date"].filter(Boolean).join(" · ")}
                  </span>
                  <AccountBox account={accounts.find((a) => a.id === r.provider_account_id)} />
                  {over > 0 && <span className="tag-sm out" style={{ marginLeft: 0 }}>Over its line by <Crc crc={over} conv={conv} /></span>}
                </div>
                <div className="side">
                  <span className="amt"><Amt amount={Number(r.amount)} currency={r.currency} conv={conv} /></span>
                  <span className="acts">
                    <FileButton path={r.invoice_path} name={r.invoice_name} label="Invoice" />
                    {r.budget && <Link className="btn sm ghost" href={`/finance/budgets/${r.budget.id}`}>Budget</Link>}
                    <button type="button" className="btn sm primary" onClick={() => pay.openItem(r)}>Mark paid</button>
                    <button type="button" className="btn sm ghost" onClick={() => reject.openItem(r)}>Reject</button>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Drawer
        key={`rv-${review.item?.id ?? "none"}`}
        title="Review budget"
        open={review.open}
        onClose={review.close}
        action={reviewBudget}
        footer={
          <>
            <button type="submit" name="decision" value="rejected" className="btn danger">Reject</button>
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={review.close}>Cancel</button>
            <button type="submit" name="decision" value="approved" className="btn primary">Approve</button>
          </>
        }
      >
        {review.item && (
          <>
            <input type="hidden" name="id" value={review.item.id} />
            <p style={{ marginTop: 0 }}>
              <b>{review.item.name}</b><br />
              <span className="muted">{sector(review.item.division_id)} · {typeName(review.item.type)} · planned <Crc crc={plannedOf(review.item.id)} conv={conv} /></span>
            </p>
            <ul className="muted" style={{ fontSize: 14, paddingLeft: 18 }}>
              {lines.filter((l) => l.budget_id === review.item?.id).map((l) => (
                <li key={l.id}>{l.category}: <Crc crc={Number(l.planned_crc)} conv={conv} /></li>
              ))}
            </ul>
            <div className="fld">
              <label htmlFor="q-c">Comment</label>
              <textarea id="q-c" name="comment" rows={4} placeholder="Optional when approving. Required when rejecting." />
            </div>
          </>
        )}
      </Drawer>

      <Drawer
        key={`pay-${pay.item?.id ?? "none"}`}
        title="Mark paid"
        open={pay.open}
        onClose={pay.close}
        action={payRequest}
        footer={
          <>
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={pay.close}>Cancel</button>
            <button type="submit" className="btn primary">Mark paid</button>
          </>
        }
      >
        {pay.item && (
          <>
            <input type="hidden" name="id" value={pay.item.id} />
            <p style={{ marginTop: 0 }}>
              <b>{pay.item.provider?.name}</b> · <Amt amount={Number(pay.item.amount)} currency={pay.item.currency} conv={conv} />
            </p>
            <AccountBox account={accounts.find((a) => a.id === pay.item?.provider_account_id)} />
            <div className="fld" style={{ marginTop: 14 }}>
              <label htmlFor="q-on">Paid on</label>
              <input id="q-on" name="paid_on" type="date" defaultValue={today} />
            </div>
            <FileField
              name="payment_receipt"
              folder={`${pay.item.budget?.division_id}/${pay.item.budget_id}/payment`}
              label="Payment receipt"
              required
            />
          </>
        )}
      </Drawer>

      <Drawer
        key={`rj-${reject.item?.id ?? "none"}`}
        title="Reject request"
        open={reject.open}
        onClose={reject.close}
        action={rejectRequest}
        footer={
          <>
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={reject.close}>Cancel</button>
            <button type="submit" className="btn danger">Reject request</button>
          </>
        }
      >
        {reject.item && <input type="hidden" name="id" value={reject.item.id} />}
        <div className="fld">
          <label htmlFor="q-r">Why?</label>
          <textarea id="q-r" name="reason" rows={3} placeholder="So the sector knows what to fix" />
        </div>
      </Drawer>
    </>
  );
}
