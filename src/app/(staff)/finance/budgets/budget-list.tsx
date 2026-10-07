"use client";

import Link from "next/link";
import { useState } from "react";
import { Drawer, useDrawer } from "@/components/drawer";
import {
  BUDGET_STATUS,
  BUDGET_TYPES,
  type Budget,
  periodLabel,
  show,
  statusName,
  statusTone,
  touchesMonth,
  typeName,
} from "@/lib/budgets";
import { type Conv } from "@/lib/finance";
import { colorVar } from "@/lib/roles";
import { fmtMoney } from "@/lib/shop";
import { saveBudget } from "./actions";
import { BudgetFields } from "./budget-fields";

export type Card = {
  budget: Budget;
  planned: number;
  spent: number;
  lineCount: number;
};

export function BudgetList({
  cards,
  divisions,
  myDivision,
  isAdmin,
  conv,
}: {
  cards: Card[];
  divisions: { id: string; name: string; color: string }[];
  myDivision: string | null;
  isAdmin: boolean;
  conv: Conv;
}) {
  const [sector, setSector] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [month, setMonth] = useState("");
  const drawer = useDrawer<true>();
  const money = (crc: number) => fmtMoney(show(crc, conv), conv.to);
  const mark = conv.to === "CRC" ? "" : "~";

  const list = cards.filter(
    ({ budget: b }) =>
      (!sector || b.division_id === sector) &&
      (!type || b.type === type) &&
      (!status || b.status === status) &&
      (!month || touchesMonth(b, month)),
  );
  const canCreate = isAdmin || !!myDivision;

  return (
    <>
      <div className="toolbar">
        {isAdmin && (
          <select className="field-in" aria-label="Sector" value={sector} onChange={(e) => setSector(e.target.value)}>
            <option value="">All sectors</option>
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        )}
        <select className="field-in" aria-label="Type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Monthly and Project</option>
          {BUDGET_TYPES.map(([k, n]) => (
            <option key={k} value={k}>{n}</option>
          ))}
        </select>
        <select className="field-in" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any status</option>
          {BUDGET_STATUS.map(([k, n]) => (
            <option key={k} value={k}>{n}</option>
          ))}
        </select>
        <input className="field-in" type="month" aria-label="Period" value={month} onChange={(e) => setMonth(e.target.value)} />
        <span style={{ marginLeft: "auto" }}>
          {canCreate && (
            <button type="button" className="btn primary" onClick={() => drawer.openItem(true)}>
              New budget
            </button>
          )}
        </span>
      </div>

      {!cards.length ? (
        <div className="empty">
          <p>
            {canCreate
              ? "No budgets yet. Create one, add its lines, and send it for approval."
              : "You’re not assigned to a sector yet. Ask an admin to set your Division in Settings → Team."}
          </p>
        </div>
      ) : !list.length ? (
        <div className="empty"><p>Nothing matches those filters.</p></div>
      ) : (
        <div className="bp-cards">
          {list.map(({ budget: b, planned, spent, lineCount }) => {
            const pct = planned > 0 ? Math.round((spent / planned) * 100) : spent > 0 ? 100 : 0;
            return (
              <Link key={b.id} href={`/finance/budgets/${b.id}`} className="bp-card">
                <h3>{b.name}</h3>
                <span className="sub">
                  {b.division && (
                    <span className="dot-label"><i style={{ background: colorVar(b.division.color) }} />{b.division.name}</span>
                  )}
                  {" · "}
                  {periodLabel(b)}
                </span>
                <span className="tag-sm" style={{ margin: "0 6px 6px 0" }}>{typeName(b.type)}</span>
                <span className={`tag-sm ${statusTone(b.status)}`} style={{ margin: "0 0 6px" }}>{statusName(b.status)}</span>
                <div className={`meter ${pct > 100 ? "over" : pct >= 90 ? "warn" : ""}`}>
                  <span style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                <div className="nums">
                  <span><b>{pct}%</b> {b.type === "monthly" ? "spent" : "committed"}</span>
                  <span>
                    <b>{mark}{money(Math.max(0, planned - spent))}</b> left of {mark}{money(planned)}
                  </span>
                </div>
                {!lineCount && b.status === "draft" && (
                  <span className="sub" style={{ marginTop: 6 }}>No lines yet</span>
                )}
              </Link>
            );
          })}
        </div>
      )}

      <Drawer
        title="New budget"
        open={drawer.open}
        onClose={drawer.close}
        action={saveBudget}
        footer={
          <>
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={drawer.close}>Cancel</button>
            <button type="submit" className="btn primary">Create draft</button>
          </>
        }
      >
        <BudgetFields divisions={divisions} isAdmin={isAdmin} />
      </Drawer>
    </>
  );
}
