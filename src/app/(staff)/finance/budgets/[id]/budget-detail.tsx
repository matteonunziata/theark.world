"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ConfirmButton, Drawer, useDrawer } from "@/components/drawer";
import { useToast } from "@/components/toast";
import type { ActionResult } from "@/lib/action-result";
import {
  type Budget,
  type BudgetLine,
  budgetStats,
  fmtStamp,
  type LineTotals,
  periodLabel,
  REQUEST_STATUS,
  statusName,
  statusTone,
  typeName,
  used,
} from "@/lib/budgets";
import type { Tables } from "@/lib/database.types";
import { type Conv } from "@/lib/finance";
import { colorVar } from "@/lib/roles";
import { fmtMoney } from "@/lib/shop";
import {
  closeBudget,
  logMovement,
  payRequest,
  rejectRequest,
  reopenBudget,
  requestPayment,
  reviewBudget,
  saveBudget,
  saveLine,
  submitBudget,
} from "../actions";
import { BudgetFields } from "../budget-fields";
import { FileField } from "../file-field";
import { type Account, AccountBox, Amt, Crc, FileButton } from "../parts";

type Req = Tables<"payment_requests">;
type Move = Tables<"budget_movements">;
type Event = Tables<"budget_events">;
type Division = { id: string; name: string; color: string };

type Props = {
  budget: Budget;
  lines: BudgetLine[];
  totals: LineTotals[];
  movements: Move[];
  requests: Req[];
  events: Event[];
  providers: { id: string; name: string }[];
  accounts: Account[];
  approver: string | null;
  divisions: Division[];
  isAdmin: boolean;
  canWork: boolean;
  conv: Conv;
  today: string;
};

const EVENT_TEXT: Record<string, Record<string, string>> = {
  budget: {
    draft: "Budget saved as a draft",
    pending: "Sent for approval",
    approved: "Approved",
    rejected: "Rejected",
    closed: "Closed",
  },
  payment_request: { requested: "Payment requested", paid: "Payment made", rejected: "Payment request rejected" },
  movement: { logged: "Expense logged" },
};

export function BudgetDetail(p: Props) {
  const { budget: b, conv, isAdmin, canWork } = p;
  const toast = useToast();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<"items" | "history">("items");
  const edit = useDrawer<true>();
  const lineDrawer = useDrawer<BudgetLine>();
  const log = useDrawer<true>();
  const request = useDrawer<true>();
  const review = useDrawer<true>();
  const pay = useDrawer<Req>();
  const reject = useDrawer<Req>();

  const monthly = b.type === "monthly";
  const draft = b.status === "draft";
  const approved = b.status === "approved";
  const stats = budgetStats(b.type, p.lines, p.totals);
  const totalOf = (id: string) => p.totals.find((t) => t.line_id === id);
  const lineName = (id: string) => p.lines.find((l) => l.id === id)?.category ?? "—";
  const provName = (id: string | null) => p.providers.find((x) => x.id === id)?.name ?? null;
  const acct = (id: string) => p.accounts.find((a) => a.id === id);
  const folder = (kind: string) => `${b.division_id}/${b.id}/${kind}`;

  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      const r = await fn();
      toast(r.ok ? (r.message ?? "") : (r.error ?? ""));
    });

  const pct = (spent: number, planned: number) =>
    planned > 0 ? Math.round((spent / planned) * 100) : spent > 0 ? 100 : 0;
  const barClass = (n: number) => (n > 100 ? "over" : n >= 90 ? "warn" : "");
  const overall = pct(stats.spent, stats.planned);

  return (
    <>
      <p style={{ margin: "0 0 10px" }}>
        <Link href="/finance/budgets" className="linkish">← All budgets</Link>
      </p>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ margin: "0 0 4px", overflowWrap: "anywhere" }}>{b.name}</h2>
        <span className="muted" style={{ fontSize: 14 }}>
          {b.division && (
            <span className="dot-label"><i style={{ background: colorVar(b.division.color) }} />{b.division.name}</span>
          )}
          {" · "}{periodLabel(b)}
        </span>
        <div style={{ marginTop: 6 }}>
          <span className="tag-sm" style={{ marginLeft: 0 }}>{typeName(b.type)}</span>
          <span className={`tag-sm ${statusTone(b.status)}`}>{statusName(b.status)}</span>
        </div>
      </div>

      {b.status === "rejected" && (
        <div className="bp-note bad"><b>Rejected.</b> {b.review_comment || "No comment left."} Reopen it as a draft, fix it, and send it again.</div>
      )}
      {b.status === "pending" && (
        <div className="bp-note">Waiting for an admin to approve. {canWork && !isAdmin ? "You can recall it to a draft to change it." : ""}</div>
      )}
      {(approved || b.status === "closed") && b.approved_at && (
        <div className="bp-note">
          Approved{p.approver ? ` by ${p.approver}` : ""} on {fmtStamp(b.approved_at)}.
          {b.review_comment ? ` “${b.review_comment}”` : ""}
        </div>
      )}
      {draft && !p.lines.length && canWork && (
        <div className="bp-note">Add the lines this budget will cover (a category and a planned amount), then send it for approval.</div>
      )}

      <div className="bp-acts">
        {canWork && draft && (
          <>
            <button type="button" className="btn" onClick={() => edit.openItem(true)}>Edit budget</button>
            <button type="button" className="btn" onClick={lineDrawer.openNew}>Add a line</button>
            <button type="button" className="btn primary" disabled={pending || !p.lines.length} onClick={() => run(() => submitBudget(b.id))}>
              Send for approval
            </button>
          </>
        )}
        {canWork && b.status === "pending" && !isAdmin && (
          <button type="button" className="btn" disabled={pending} onClick={() => run(() => reopenBudget(b.id))}>Recall to draft</button>
        )}
        {isAdmin && b.status === "pending" && (
          <button type="button" className="btn primary" onClick={() => review.openItem(true)}>Review: approve or reject</button>
        )}
        {canWork && b.status === "rejected" && (
          <button type="button" className="btn primary" disabled={pending} onClick={() => run(() => reopenBudget(b.id))}>Reopen as draft</button>
        )}
        {canWork && approved && monthly && (
          <button type="button" className="btn primary" onClick={() => log.openItem(true)}>Log an expense</button>
        )}
        {canWork && approved && !monthly && (
          <button type="button" className="btn primary" onClick={() => request.openItem(true)}>Request a payment</button>
        )}
        {isAdmin && approved && (
          <button type="button" className="btn ghost" disabled={pending} onClick={() => run(() => closeBudget(b.id))}>Close budget</button>
        )}
      </div>

      <div className="stats" style={{ marginBottom: 18 }}>
        <div className="stat"><b><Crc crc={stats.planned} conv={conv} /></b><span>Planned</span></div>
        <div className="stat"><b><Crc crc={stats.spent} conv={conv} /></b><span>{monthly ? "Spent" : "Committed (paid + requested)"}</span></div>
        <div className="stat">
          <b style={stats.remaining < 0 ? { color: "var(--danger)" } : undefined}><Crc crc={stats.remaining} conv={conv} /></b>
          <span>Remaining · {overall}% used</span>
        </div>
      </div>

      <h3 className="section-title">Lines</h3>
      {!p.lines.length ? (
        <div className="empty"><p>No lines yet.</p></div>
      ) : (
        <div className="bp-lines">
          {p.lines.map((l) => {
            const spent = used(b.type, totalOf(l.id));
            const planned = Number(l.planned_crc);
            const n = pct(spent, planned);
            const left = planned - spent;
            const open = canWork && draft;
            return (
              <div
                key={l.id}
                className={`bp-line ${open ? "clickable" : ""}`}
                {...(open
                  ? { role: "button", tabIndex: 0, onClick: () => lineDrawer.openItem(l), onKeyDown: (e: React.KeyboardEvent) => e.key === "Enter" && lineDrawer.openItem(l) }
                  : {})}
              >
                <div className="top">
                  <b>{l.category}</b>
                  <span className="muted" style={{ fontSize: 13 }}>
                    {n}%{l.planned_usd != null ? ` · plan also set at ${fmtMoney(l.planned_usd, "USD")}` : ""}
                  </span>
                </div>
                <div className={`meter ${barClass(n)}`}><span style={{ width: `${Math.min(100, n)}%` }} /></div>
                <div className="nums">
                  <span><b><Crc crc={planned} conv={conv} /></b>planned</span>
                  <span><b><Crc crc={spent} conv={conv} /></b>{monthly ? "spent" : "committed"}</span>
                  <span><b className={left < 0 ? "neg" : ""}><Crc crc={left} conv={conv} /></b>{left < 0 ? "over" : "remaining"}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="seg" role="group" aria-label="Section">
        <button type="button" className={tab === "items" ? "on" : ""} onClick={() => setTab("items")}>
          {monthly ? `Expenses (${p.movements.length})` : `Payment requests (${p.requests.length})`}
        </button>
        <button type="button" className={tab === "history" ? "on" : ""} onClick={() => setTab("history")}>
          History ({p.events.length})
        </button>
      </div>

      {tab === "items" && monthly && (
        !p.movements.length ? (
          <div className="empty"><p>{approved ? "No expenses logged yet. Log what you spend, with the receipt." : "Expenses can be logged once the budget is approved."}</p></div>
        ) : (
          <div className="bp-rows">
            {p.movements.map((m) => (
              <div key={m.id} className="bp-item">
                <div className="main">
                  <b>{m.description}</b>
                  <span className="meta">
                    {[new Date(`${m.movement_date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }), lineName(m.line_id), provName(m.provider_id)].filter(Boolean).join(" · ")}
                  </span>
                </div>
                <div className="side">
                  <span className="amt"><Amt amount={Number(m.amount)} currency={m.currency} conv={conv} /></span>
                  <FileButton path={m.receipt_path} name={m.receipt_name} label="Receipt" />
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === "items" && !monthly && (
        !p.requests.length ? (
          <div className="empty"><p>{approved ? "No payment requests yet." : "Payments can be requested once the budget is approved."}</p></div>
        ) : (
          <div className="bp-rows">
            {p.requests.map((r) => (
              <div key={r.id} className="bp-item">
                <div className="main">
                  <b>{provName(r.provider_id) ?? "Provider"}{r.milestone ? ` · ${r.milestone}` : ""}</b>
                  <span className="meta">
                    {[lineName(r.line_id), r.due_date ? `due ${new Date(`${r.due_date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}` : null, `requested ${fmtStamp(r.requested_at)}`].filter(Boolean).join(" · ")}
                  </span>
                  <AccountBox account={acct(r.provider_account_id)} />
                  {r.status === "rejected" && r.reject_reason && <span className="meta">Rejected: {r.reject_reason}</span>}
                  {r.status === "paid" && r.paid_at && <span className="meta">Paid {fmtStamp(r.paid_at)}</span>}
                </div>
                <div className="side">
                  <span className="amt"><Amt amount={Number(r.amount)} currency={r.currency} conv={conv} /></span>
                  <span className={`tag-sm ${r.status === "paid" ? "ok" : r.status === "rejected" ? "out" : "low"}`} style={{ margin: 0 }}>
                    {REQUEST_STATUS[r.status as keyof typeof REQUEST_STATUS] ?? r.status}
                  </span>
                  <span className="acts">
                    <FileButton path={r.invoice_path} name={r.invoice_name} label="Invoice" />
                    <FileButton path={r.payment_receipt_path} name={r.payment_receipt_name} label="Payment receipt" />
                    {isAdmin && r.status === "requested" && (
                      <>
                        <button type="button" className="btn sm primary" onClick={() => pay.openItem(r)}>Mark paid</button>
                        <button type="button" className="btn sm ghost" onClick={() => reject.openItem(r)}>Reject</button>
                      </>
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === "history" && (
        <ul className="bp-hist">
          {p.events.map((e) => (
            <li key={e.id}>
              <b>{EVENT_TEXT[e.entity]?.[e.to_status] ?? e.to_status}</b>
              {e.comment ? ` — “${e.comment}”` : ""}
              <time>{fmtStamp(e.created_at)}{e.actor_name ? ` · ${e.actor_name}` : ""}</time>
            </li>
          ))}
        </ul>
      )}

      {/* Edit the budget (drafts only) */}
      <Drawer
        key={`edit-${b.id}`}
        title="Edit budget"
        open={edit.open}
        onClose={edit.close}
        action={saveBudget}
        footer={
          <>
            <ConfirmButton label="Delete draft" />
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={edit.close}>Cancel</button>
            <button type="submit" className="btn primary">Save</button>
          </>
        }
      >
        <BudgetFields budget={b} divisions={p.divisions} isAdmin={isAdmin} />
      </Drawer>

      {/* Add or edit a line (drafts only) */}
      <Drawer
        key={lineDrawer.item?.id ?? "new-line"}
        title={lineDrawer.item ? "Edit line" : "Add a line"}
        open={lineDrawer.open}
        onClose={lineDrawer.close}
        action={saveLine}
        footer={
          <>
            {lineDrawer.item && <ConfirmButton label="Remove line" />}
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={lineDrawer.close}>Cancel</button>
            <button type="submit" className="btn primary">Save</button>
          </>
        }
      >
        <input type="hidden" name="budget_id" value={b.id} />
        {lineDrawer.item && <input type="hidden" name="id" value={lineDrawer.item.id} />}
        <div className="fld">
          <label htmlFor="l-cat">Category</label>
          <input id="l-cat" name="category" required autoFocus defaultValue={lineDrawer.item?.category ?? ""} placeholder="e.g. Seeds and soil" />
          <span className="hint">Salaries aren’t part of sector budgets.</span>
        </div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="l-crc">Planned, in colones (₡)</label>
            <input id="l-crc" name="planned_crc" type="number" min={0} step="any" required defaultValue={lineDrawer.item?.planned_crc ?? ""} />
          </div>
          <div className="fld">
            <label htmlFor="l-usd">Planned in dollars ($), optional</label>
            <input id="l-usd" name="planned_usd" type="number" min={0} step="any" defaultValue={lineDrawer.item?.planned_usd ?? ""} />
          </div>
        </div>
      </Drawer>

      {/* Log an expense (Monthly) */}
      <Drawer
        title="Log an expense"
        open={log.open}
        onClose={log.close}
        action={logMovement}
        footer={
          <>
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={log.close}>Cancel</button>
            <button type="submit" className="btn primary">Log expense</button>
          </>
        }
      >
        <input type="hidden" name="budget_id" value={b.id} />
        <SpendFields lines={p.lines} totals={p.totals} type={b.type} conv={conv} today={p.today} />
        <div className="fld">
          <label htmlFor="mv-desc">What was it for?</label>
          <input id="mv-desc" name="description" required placeholder="e.g. Irrigation parts" />
        </div>
        <div className="fld">
          <label htmlFor="mv-prov">Provider (optional)</label>
          <select id="mv-prov" name="provider_id" defaultValue="">
            <option value="">No provider</option>
            {p.providers.map((x) => (
              <option key={x.id} value={x.id}>{x.name}</option>
            ))}
          </select>
        </div>
        <FileField name="receipt" folder={folder("receipt")} label="Receipt" required />
      </Drawer>

      {/* Request a payment (Project) */}
      <Drawer
        title="Request a payment"
        open={request.open}
        onClose={request.close}
        action={requestPayment}
        footer={
          <>
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={request.close}>Cancel</button>
            <button type="submit" className="btn primary">Send request</button>
          </>
        }
      >
        <input type="hidden" name="budget_id" value={b.id} />
        <RequestFields providers={p.providers} accounts={p.accounts} lines={p.lines} totals={p.totals} conv={conv} type={b.type} />
        <div className="grid2">
          <div className="fld">
            <label htmlFor="rq-due">Due date</label>
            <input id="rq-due" name="due_date" type="date" />
          </div>
          <div className="fld">
            <label htmlFor="rq-ms">Milestone</label>
            <input id="rq-ms" name="milestone" placeholder="e.g. Foundations done" />
          </div>
        </div>
        <FileField name="invoice" folder={folder("invoice")} label="Invoice (optional)" />
      </Drawer>

      {/* Approve or reject (admin) */}
      <Drawer
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
        <input type="hidden" name="id" value={b.id} />
        <p className="muted" style={{ marginTop: 0 }}>
          {b.name}: planned <Crc crc={stats.planned} conv={conv} /> across {p.lines.length} line{p.lines.length === 1 ? "" : "s"}.
        </p>
        <div className="fld">
          <label htmlFor="rv-c">Comment</label>
          <textarea id="rv-c" name="comment" rows={4} placeholder="Optional when approving. Required when rejecting, so the sector knows what to fix." />
        </div>
      </Drawer>

      {/* Mark a request paid (admin) */}
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
              <b>{provName(pay.item.provider_id)}</b> · <Amt amount={Number(pay.item.amount)} currency={pay.item.currency} conv={conv} />
            </p>
            <AccountBox account={acct(pay.item.provider_account_id)} />
            <div className="fld" style={{ marginTop: 14 }}>
              <label htmlFor="pay-on">Paid on</label>
              <input id="pay-on" name="paid_on" type="date" defaultValue={p.today} />
            </div>
            <FileField name="payment_receipt" folder={folder("payment")} label="Payment receipt" required />
          </>
        )}
      </Drawer>

      <Drawer
        key={`rej-${reject.item?.id ?? "none"}`}
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
          <label htmlFor="rj-r">Why?</label>
          <textarea id="rj-r" name="reason" rows={3} placeholder="So the sector knows what to fix" />
        </div>
      </Drawer>
    </>
  );
}

/** Line, date, amount and currency, with a heads-up when it would go over the line. */
function SpendFields({
  lines,
  totals,
  type,
  conv,
  today,
}: {
  lines: BudgetLine[];
  totals: LineTotals[];
  type: string;
  conv: Conv;
  today: string;
}) {
  const [line, setLine] = useState("");
  const [amount, setAmount] = useState("");
  const [cur, setCur] = useState<"CRC" | "USD">("CRC");
  return (
    <>
      <div className="fld">
        <label htmlFor="sp-line">Line</label>
        <select id="sp-line" name="line_id" required value={line} onChange={(e) => setLine(e.target.value)}>
          <option value="" disabled>Choose a line</option>
          {lines.map((l) => (
            <option key={l.id} value={l.id}>{l.category}</option>
          ))}
        </select>
      </div>
      <div className="grid2">
        <div className="fld">
          <label htmlFor="sp-amt">Amount</label>
          <input id="sp-amt" name="amount" type="number" min={0} step="any" required value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="fld">
          <label htmlFor="sp-cur">Currency</label>
          <select id="sp-cur" name="currency" value={cur} onChange={(e) => setCur(e.target.value as "CRC" | "USD")}>
            <option value="CRC">Colones (₡)</option>
            <option value="USD">US dollars ($)</option>
          </select>
        </div>
      </div>
      <OverNote lines={lines} totals={totals} type={type} line={line} amount={amount} cur={cur} conv={conv} />
      <div className="fld">
        <label htmlFor="sp-date">Date</label>
        <input id="sp-date" name="movement_date" type="date" required defaultValue={today} />
      </div>
    </>
  );
}

function RequestFields({
  providers,
  accounts,
  lines,
  totals,
  conv,
  type,
}: {
  providers: { id: string; name: string }[];
  accounts: Account[];
  lines: BudgetLine[];
  totals: LineTotals[];
  conv: Conv;
  type: string;
}) {
  const [line, setLine] = useState("");
  const [provider, setProvider] = useState("");
  const [amount, setAmount] = useState("");
  const [cur, setCur] = useState<"CRC" | "USD">("CRC");
  const mine = accounts.filter((a) => a.provider_id === provider);
  return (
    <>
      <div className="fld">
        <label htmlFor="rq-line">Line</label>
        <select id="rq-line" name="line_id" required value={line} onChange={(e) => setLine(e.target.value)}>
          <option value="" disabled>Choose a line</option>
          {lines.map((l) => (
            <option key={l.id} value={l.id}>{l.category}</option>
          ))}
        </select>
      </div>
      <div className="fld">
        <label htmlFor="rq-prov">Provider</label>
        <select id="rq-prov" name="provider_id" required value={provider} onChange={(e) => setProvider(e.target.value)}>
          <option value="" disabled>Choose a provider</option>
          {providers.map((x) => (
            <option key={x.id} value={x.id}>{x.name}</option>
          ))}
        </select>
        {!providers.length && (
          <span className="hint">No providers yet. Add one under <Link href="/finance/providers" className="linkish">Providers</Link>.</span>
        )}
      </div>
      <div className="fld">
        <label htmlFor="rq-acct">Provider bank account</label>
        <select id="rq-acct" name="provider_account_id" required defaultValue="" key={provider}>
          <option value="" disabled>{provider ? "Choose an account" : "Choose a provider first"}</option>
          {mine.map((a) => (
            <option key={a.id} value={a.id}>{a.bank} · {a.account_holder} · {a.account_number}</option>
          ))}
        </select>
        {provider && !mine.length && (
          <span className="hint">No bank account for this provider that your sector can use. Add one under <Link href="/finance/providers" className="linkish">Providers</Link>.</span>
        )}
      </div>
      <div className="grid2">
        <div className="fld">
          <label htmlFor="rq-amt">Amount</label>
          <input id="rq-amt" name="amount" type="number" min={0} step="any" required value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="fld">
          <label htmlFor="rq-cur">Currency</label>
          <select id="rq-cur" name="currency" value={cur} onChange={(e) => setCur(e.target.value as "CRC" | "USD")}>
            <option value="CRC">Colones (₡)</option>
            <option value="USD">US dollars ($)</option>
          </select>
        </div>
      </div>
      <OverNote lines={lines} totals={totals} type={type} line={line} amount={amount} cur={cur} conv={conv} />
    </>
  );
}

/** A warning, not a block: this would push the line past what was planned. */
function OverNote({
  lines,
  totals,
  type,
  line,
  amount,
  cur,
  conv,
}: {
  lines: BudgetLine[];
  totals: LineTotals[];
  type: string;
  line: string;
  amount: string;
  cur: "CRC" | "USD";
  conv: Conv;
}) {
  const l = lines.find((x) => x.id === line);
  const n = Number(amount);
  if (!l || !(n > 0)) return null;
  const crc = cur === "USD" ? n * conv.rate : n;
  const left = Number(l.planned_crc) - used(type, totals.find((t) => t.line_id === l.id));
  if (crc <= left) return null;
  return (
    <div className="bp-note bad" role="status">
      This puts “{l.category}” {fmtMoney(crc - Math.max(0, left), "CRC")} over its planned amount. You can still save it.
    </div>
  );
}
