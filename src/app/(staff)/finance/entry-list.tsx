"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import { fmtDate } from "@/lib/dates";
import {
  docName,
  type Entry,
  convert,
  type Conv,
  fmtSum,
  type Line,
  methodName,
  overdueDays,
} from "@/lib/finance";
import { colorVar } from "@/lib/roles";
import { fmtMoney } from "@/lib/shop";
import { markPaid } from "./actions";
import { type DrawerTarget, EntryDrawer, openFile } from "./entry-drawer";

type Mode = "all" | "documents" | "payables" | "receivables";

const COPY: Record<Mode, { empty: string; add: DrawerTarget[] }> = {
  all: {
    empty: "No transactions yet. Add income as it comes in and expenses as they go out, with the receipt attached.",
    add: [{ kind: "income" }, { kind: "expense" }],
  },
  documents: {
    empty: "No receipts or invoices attached yet. Attach one to any transaction, or add a bill or invoice here.",
    add: [{ kind: "expense", doc: "receipt" }, { kind: "expense", status: "unpaid", doc: "bill" }, { kind: "income", status: "unpaid", doc: "invoice" }],
  },
  payables: {
    empty: "Nothing owed. Bills that come in and aren’t paid yet show up here with their due dates.",
    add: [{ kind: "expense", status: "unpaid", doc: "bill" }],
  },
  receivables: {
    empty: "Nobody owes The ARK anything right now. Invoices sent and not yet paid show up here.",
    add: [{ kind: "income", status: "unpaid", doc: "invoice" }],
  },
};

const addLabel = (t: DrawerTarget) =>
  "entry" in t
    ? ""
    : t.doc === "bill"
      ? "Add a bill"
      : t.doc === "invoice"
        ? "Add an invoice"
        : t.doc === "receipt"
          ? "Add a receipt"
          : t.kind === "income"
            ? "Add income"
            : "Add expense";

export function EntryList({
  entries,
  lines,
  conv,
  today,
  mode,
}: {
  entries: Entry[];
  lines: Line[];
  conv: Conv;
  today: string;
  mode: Mode;
}) {
  const [target, setTarget] = useState<DrawerTarget | null>(null);
  const router = useRouter();
  // Property invoices and payouts are edited on the property's Financials tab.
  const open = (e: Entry) => (e.lot_id ? router.push(`/estate/${e.lot_id}?tab=financials`) : setTarget({ entry: e }));
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [line, setLine] = useState("");
  const [month, setMonth] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  const lineOf = (id: string | null) => lines.find((l) => l.id === id);
  const months = [...new Set(entries.map((e) => e.entry_date.slice(0, 7)))].sort().reverse();

  const needle = q.trim().toLowerCase();
  const list = entries.filter(
    (e) =>
      (!kind || e.kind === kind) &&
      (!line || (line === "none" ? !e.business_line_id : e.business_line_id === line)) &&
      (!month || e.entry_date.startsWith(month)) &&
      (!needle ||
        [e.party, e.description, e.category, e.reference, e.file_name]
          .filter(Boolean)
          .some((s) => s!.toLowerCase().includes(needle))),
  );
  const owed = mode === "payables" || mode === "receivables";
  const inc = list.filter((e) => e.kind === "income");
  const exp = list.filter((e) => e.kind === "expense");
  const overdue = list.filter((e) => e.status === "unpaid" && (overdueDays(e.due_date, today) ?? 0) > 0);

  const pay = (id: string) =>
    start(async () => {
      const r = await markPaid(id);
      toast(r.ok ? (r.message ?? "") : (r.error ?? ""));
    });

  return (
    <>
      {owed ? (
        <div className="stats" style={{ marginBottom: 18 }}>
          <div className="stat"><b>{fmtSum(list, conv)}</b><span>{mode === "payables" ? "The ARK owes" : "Owed to The ARK"}</span></div>
          <div className="stat"><b>{list.length}</b><span>Open {mode === "payables" ? "bills" : "invoices"}</span></div>
          <div className="stat"><b>{fmtSum(overdue, conv)}</b><span>Overdue ({overdue.length})</span></div>
        </div>
      ) : (
        <div className="stats" style={{ marginBottom: 18 }}>
          <div className="stat"><b>{fmtSum(inc, conv)}</b><span>Income{month ? "" : ", all time"}</span></div>
          <div className="stat"><b>{fmtSum(exp, conv)}</b><span>Expenses{month ? "" : ", all time"}</span></div>
          <div className="stat"><b>{list.length}</b><span>{mode === "documents" ? "Documents" : "Transactions"}</span></div>
        </div>
      )}
      <div className="toolbar">
        <input className="field-in search" type="search" placeholder="Search who, what, number" aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        {!owed && (
          <select className="field-in" aria-label="Income or expense" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">Income and expenses</option>
            <option value="income">Income</option>
            <option value="expense">Expenses</option>
          </select>
        )}
        <select className="field-in" aria-label="Business line" value={line} onChange={(e) => setLine(e.target.value)}>
          <option value="">All business lines</option>
          {lines.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
          <option value="none">Not assigned</option>
        </select>
        {!owed && months.length > 1 && (
          <select className="field-in" aria-label="Month" value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="">All months</option>
            {months.map((m) => (
              <option key={m} value={m}>{new Date(`${m}-01T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</option>
            ))}
          </select>
        )}
        <span style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {COPY[mode].add.map((t, i) => (
            <button key={i} type="button" className={`btn ${i === COPY[mode].add.length - 1 ? "primary" : ""}`} onClick={() => setTarget(t)}>
              {addLabel(t)}
            </button>
          ))}
        </span>
      </div>
      {!entries.length ? (
        <div className="empty"><p>{COPY[mode].empty}</p></div>
      ) : !list.length ? (
        <div className="empty"><p>Nothing matches.</p></div>
      ) : (
        <div className="list">
          <div className="row head erow">
            <span>{owed ? "Due" : "Date"}</span>
            <span>What</span>
            <span className="c-line">Business line</span>
            <span className="c-amt">Amount</span>
            <span />
          </div>
          {list.map((e) => {
            const l = lineOf(e.business_line_id);
            const late = e.status === "unpaid" ? overdueDays(e.due_date, today) : null;
            return (
              <div className="row erow" key={e.id} role="button" tabIndex={0} onClick={() => open(e)} onKeyDown={(ev) => ev.key === "Enter" && open(e)}>
                <span>
                  {owed ? (e.due_date ? fmtDate(e.due_date) : "No due date") : fmtDate(e.entry_date)}
                  {late !== null && late > 0 && <span className="tag-sm out" style={{ display: "block", width: "fit-content" }}>{late} days late</span>}
                  {late !== null && late <= 0 && late > -8 && <span className="tag-sm low" style={{ display: "block", width: "fit-content" }}>{late === 0 ? "due today" : `in ${-late} days`}</span>}
                </span>
                <span className="who" style={{ display: "block" }}>
                  <b>{e.party || e.description || e.category || (e.kind === "income" ? "Income" : "Expense")}</b>
                  <span className="muted" style={{ fontSize: 13, display: "block" }}>
                    {[e.party ? e.description : null, e.category, e.status === "paid" && e.method ? methodName(e.method) : null, e.reference ? `#${e.reference}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {e.lot && (
                    <Link
                      href={`/estate/${e.lot.id}?tab=financials`}
                      className="tag-sm"
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      {e.lot.name ?? `Lot ${e.lot.code}`}
                    </Link>
                  )}
                  {(e.doc_kind || e.file_path) && (
                    <span className="tag-sm">
                      {docName(e.doc_kind)}
                      {e.file_path ? "" : " · no file"}
                    </span>
                  )}
                  {e.status === "unpaid" && !owed && <span className="tag-sm low">{e.kind === "income" ? "not received" : "not paid"}</span>}
                </span>
                <span className="c-line">
                  {l ? (
                    <span className="dot-label"><i style={{ background: colorVar(l.color) }} />{l.name}</span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </span>
                <span className={`c-amt amt ${e.kind}`}>
                  {e.kind === "expense" ? "−" : "+"}
                  {e.currency === conv.to
                    ? fmtMoney(e.amount, e.currency)
                    : `~${fmtMoney(convert(Number(e.amount), e.currency, conv), conv.to)}`}
                  {e.currency !== conv.to && (
                    <small className="muted" style={{ display: "block", fontWeight: 400 }}>
                      {fmtMoney(e.amount, e.currency)}
                    </small>
                  )}
                </span>
                <span className="acts" onClick={(ev) => ev.stopPropagation()} onKeyDown={(ev) => ev.stopPropagation()}>
                  {e.file_path && (
                    <button type="button" className="btn ghost sm" onClick={() => openFile(e.file_path!)}>View</button>
                  )}
                  {e.status === "unpaid" && (
                    <button type="button" className="btn sm" disabled={pending} onClick={() => pay(e.id)}>
                      {e.kind === "income" ? "Received" : "Mark paid"}
                    </button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <EntryDrawer target={target} lines={lines} currency={conv.to} today={today} onClose={() => setTarget(null)} />
    </>
  );
}
