"use client";

import { show } from "@/lib/budgets";
import { type Conv, convert } from "@/lib/finance";
import { fmtMoney } from "@/lib/shop";
import { openBudgetFile } from "./file-field";

/** An amount in its own currency, with the viewing currency beside it when they differ. */
export function Amt({ amount, currency, conv }: { amount: number; currency: string; conv: Conv }) {
  const own = fmtMoney(amount, currency);
  if (currency === conv.to) return <>{own}</>;
  return (
    <>
      ~{fmtMoney(convert(Number(amount), currency, conv), conv.to)}
      <small className="muted" style={{ display: "block", fontWeight: 400 }}>{own}</small>
    </>
  );
}

/** Colones (how lines are planned and tracked) in the viewing currency. */
export function Crc({ crc, conv }: { crc: number; conv: Conv }) {
  return <>{conv.to === "CRC" ? "" : "~"}{fmtMoney(show(crc, conv), conv.to)}</>;
}

export function FileButton({ path, name, label }: { path: string | null; name?: string | null; label: string }) {
  if (!path) return null;
  return (
    <span style={{ display: "inline-flex", gap: 6 }}>
      <button type="button" className="btn ghost sm" onClick={() => openBudgetFile(path)}>{label}</button>
      <button type="button" className="btn ghost sm" onClick={() => openBudgetFile(path, name || "receipt")} aria-label={`Download ${label.toLowerCase()}`}>
        Download
      </button>
    </span>
  );
}

export type Account = {
  id: string;
  provider_id: string;
  bank: string;
  account_holder: string;
  account_number: string;
  currency: string;
};

export function AccountBox({ account }: { account: Account | undefined }) {
  if (!account) return <span className="muted" style={{ fontSize: 13 }}>Bank account hidden</span>;
  return (
    <div className="bp-acct">
      <span>{account.bank} · {account.account_holder} · {account.currency}</span>
      <code>{account.account_number}</code>
    </div>
  );
}
