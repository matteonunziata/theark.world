"use client";

import Link from "next/link";
import { useState } from "react";
import { fmtStamp } from "@/lib/budgets";
import type { Tables } from "@/lib/database.types";
import { type Conv, convert } from "@/lib/finance";
import { fmtMoney } from "@/lib/shop";
import { Amt, FileButton } from "../budgets/parts";

type Payment = Tables<"payment_requests"> & {
  budget: { id: string; name: string; division_id: string } | null;
  provider: { name: string } | null;
  line: { category: string } | null;
};

export function PaymentsList({
  payments,
  divisions,
  isAdmin,
  conv,
}: {
  payments: Payment[];
  divisions: { id: string; name: string }[];
  isAdmin: boolean;
  conv: Conv;
}) {
  const [sector, setSector] = useState("");
  const [month, setMonth] = useState("");
  const list = payments.filter(
    (p) =>
      (!sector || p.budget?.division_id === sector) &&
      (!month || (p.paid_on ?? p.paid_at ?? "").startsWith(month)),
  );
  const total = list.reduce((s, p) => s + convert(Number(p.amount), p.currency, conv), 0);
  const approx = list.some((p) => p.currency !== conv.to);
  const sectorName = (id?: string) => divisions.find((d) => d.id === id)?.name;

  return (
    <>
      <div className="stats" style={{ marginBottom: 18 }}>
        <div className="stat"><b>{approx ? "~" : ""}{fmtMoney(total, conv.to)}</b><span>Paid{month || sector ? "" : ", all time"}</span></div>
        <div className="stat"><b>{list.length}</b><span>Payments</span></div>
      </div>
      <div className="toolbar">
        {isAdmin && (
          <select className="field-in" aria-label="Sector" value={sector} onChange={(e) => setSector(e.target.value)}>
            <option value="">All sectors</option>
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        )}
        <input className="field-in" type="month" aria-label="Month paid" value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>
      {!payments.length ? (
        <div className="empty"><p>No payments made yet. Paid requests, with their receipts, show up here.</p></div>
      ) : !list.length ? (
        <div className="empty"><p>Nothing matches.</p></div>
      ) : (
        <div className="bp-rows">
          {list.map((p) => (
            <div key={p.id} className="bp-item">
              <div className="main">
                <b>{p.provider?.name ?? "Provider"}{p.milestone ? ` · ${p.milestone}` : ""}</b>
                <span className="meta">
                  {[
                    p.line?.category,
                    isAdmin ? sectorName(p.budget?.division_id) : null,
                    p.paid_at ? `paid ${fmtStamp(p.paid_at)}` : null,
                  ].filter(Boolean).join(" · ")}
                </span>
                {p.budget && (
                  <Link href={`/finance/budgets/${p.budget.id}`} className="linkish" style={{ fontSize: 13 }}>{p.budget.name}</Link>
                )}
              </div>
              <div className="side">
                <span className="amt"><Amt amount={Number(p.amount)} currency={p.currency} conv={conv} /></span>
                <span className="acts">
                  <FileButton path={p.payment_receipt_path} name={p.payment_receipt_name} label="Payment receipt" />
                  <FileButton path={p.invoice_path} name={p.invoice_name} label="Invoice" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
