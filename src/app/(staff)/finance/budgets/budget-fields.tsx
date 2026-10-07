"use client";

import { useState } from "react";
import { BUDGET_TYPES, type Budget } from "@/lib/budgets";

/** Name, type, period (and sector for admins): shared by "New budget" and "Edit budget". */
export function BudgetFields({
  budget,
  divisions,
  isAdmin,
}: {
  budget?: Budget | null;
  divisions: { id: string; name: string }[];
  isAdmin: boolean;
}) {
  const [type, setType] = useState(budget?.type ?? "monthly");
  return (
    <>
      {budget && <input type="hidden" name="id" value={budget.id} />}
      <div className="fld">
        <label htmlFor="b-name">Name</label>
        <input id="b-name" name="name" required defaultValue={budget?.name ?? ""} placeholder="e.g. Farm, October 2026" autoFocus={!budget} />
      </div>
      <div className="grid2">
        <div className="fld">
          <label htmlFor="b-type">Type</label>
          <select id="b-type" name="type" value={type} onChange={(e) => setType(e.target.value as "monthly" | "project")} disabled={!!budget && budget.status !== "draft"}>
            {BUDGET_TYPES.map(([k, n]) => (
              <option key={k} value={k}>{n}</option>
            ))}
          </select>
        </div>
        {isAdmin && !budget && (
          <div className="fld">
            <label htmlFor="b-sector">Sector</label>
            <select id="b-sector" name="division_id" required defaultValue="">
              <option value="" disabled>Choose a sector</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      {type === "monthly" ? (
        <div className="fld">
          <label htmlFor="b-month">Month</label>
          <input id="b-month" name="period_month" type="month" required defaultValue={budget?.period_month?.slice(0, 7) ?? ""} />
          <span className="hint">Monthly budgets are for spending you log with receipts, against what you planned.</span>
        </div>
      ) : (
        <div className="grid2">
          <div className="fld">
            <label htmlFor="b-start">Starts</label>
            <input id="b-start" name="start_date" type="date" required defaultValue={budget?.start_date ?? ""} />
          </div>
          <div className="fld">
            <label htmlFor="b-end">Ends</label>
            <input id="b-end" name="end_date" type="date" required defaultValue={budget?.end_date ?? ""} />
          </div>
        </div>
      )}
      {type === "project" && (
        <span className="hint">Project budgets are paid by an admin when you request a payment.</span>
      )}
    </>
  );
}
