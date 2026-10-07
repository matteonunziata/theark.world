"use client";

import { useState } from "react";
import { ConfirmButton, Drawer, useDrawer } from "@/components/drawer";
import type { Tables } from "@/lib/database.types";
import { saveBankAccount, saveProvider } from "../budgets/actions";

type Provider = Tables<"providers">;
type Account = Tables<"provider_bank_accounts">;

export function ProviderList({
  providers,
  accounts,
  divisions,
  isAdmin,
  myStaffId,
}: {
  providers: Provider[];
  accounts: Account[];
  divisions: { id: string; name: string }[];
  isAdmin: boolean;
  myStaffId: string;
}) {
  const [q, setQ] = useState("");
  const providerDrawer = useDrawer<Provider>();
  const accountDrawer = useDrawer<{ provider: Provider; account: Account | null }>();
  const needle = q.trim().toLowerCase();
  const list = providers.filter(
    (p) => !needle || [p.name, p.contact].filter(Boolean).some((s) => s!.toLowerCase().includes(needle)),
  );
  const sectorName = (id: string | null) => divisions.find((d) => d.id === id)?.name;

  return (
    <>
      <div className="toolbar">
        <input className="field-in search" type="search" placeholder="Search providers" aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        <span style={{ marginLeft: "auto" }}>
          <button type="button" className="btn primary" onClick={providerDrawer.openNew}>Add a provider</button>
        </span>
      </div>
      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
        The directory is shared. Bank account details are only shown to admins and to the sector that added them
        or is requesting a payment with them.
      </p>

      {!providers.length ? (
        <div className="empty"><p>No providers yet. Add the people and companies you pay, with their bank accounts.</p></div>
      ) : !list.length ? (
        <div className="empty"><p>Nothing matches.</p></div>
      ) : (
        <div className="bp-rows">
          {list.map((p) => {
            const mine = accounts.filter((a) => a.provider_id === p.id);
            const canEdit = isAdmin || p.created_by === myStaffId;
            return (
              <div key={p.id} className="bp-item" style={{ display: "block" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div className="main">
                    <b>{p.name}</b>
                    {p.contact && <span className="meta">{p.contact}</span>}
                    {p.notes && <span className="meta">{p.notes}</span>}
                  </div>
                  <span className="acts">
                    {canEdit && <button type="button" className="btn sm ghost" onClick={() => providerDrawer.openItem(p)}>Edit</button>}
                    <button type="button" className="btn sm" onClick={() => accountDrawer.openItem({ provider: p, account: null })}>Add bank account</button>
                  </span>
                </div>
                {mine.map((a) => (
                  <div key={a.id} className="bp-acct">
                    <span>
                      {a.bank} · {a.account_holder} · {a.currency}
                      <small className="muted" style={{ display: "block" }}>
                        {a.division_id ? `Visible to ${sectorName(a.division_id) ?? "its sector"} and admins` : "Admins only"}
                      </small>
                    </span>
                    <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <code>{a.account_number}</code>
                      <button type="button" className="btn sm ghost" onClick={() => accountDrawer.openItem({ provider: p, account: a })}>Edit</button>
                    </span>
                  </div>
                ))}
                {!mine.length && <span className="meta">No bank account you can see yet.</span>}
              </div>
            );
          })}
        </div>
      )}

      <Drawer
        key={providerDrawer.item?.id ?? "new-provider"}
        title={providerDrawer.item ? "Edit provider" : "Add a provider"}
        open={providerDrawer.open}
        onClose={providerDrawer.close}
        action={saveProvider}
        footer={
          <>
            {providerDrawer.item && isAdmin && <ConfirmButton label="Remove" />}
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={providerDrawer.close}>Cancel</button>
            <button type="submit" className="btn primary">Save</button>
          </>
        }
      >
        {providerDrawer.item && <input type="hidden" name="id" value={providerDrawer.item.id} />}
        <div className="fld">
          <label htmlFor="pv-name">Name</label>
          <input id="pv-name" name="name" required autoFocus defaultValue={providerDrawer.item?.name ?? ""} />
        </div>
        <div className="fld">
          <label htmlFor="pv-contact">Contact</label>
          <input id="pv-contact" name="contact" defaultValue={providerDrawer.item?.contact ?? ""} placeholder="Name, phone or email" />
        </div>
        <div className="fld">
          <label htmlFor="pv-notes">Notes</label>
          <textarea id="pv-notes" name="notes" defaultValue={providerDrawer.item?.notes ?? ""} />
        </div>
        {!providerDrawer.item && (
          <>
            <div className="subhead">First bank account (optional)</div>
            <AccountFields account={null} divisions={divisions} isAdmin={isAdmin} />
          </>
        )}
      </Drawer>

      <Drawer
        key={accountDrawer.item?.account?.id ?? `acct-${accountDrawer.item?.provider.id ?? "none"}`}
        title={accountDrawer.item?.account ? "Edit bank account" : `Bank account for ${accountDrawer.item?.provider.name ?? ""}`}
        open={accountDrawer.open}
        onClose={accountDrawer.close}
        action={saveBankAccount}
        footer={
          <>
            {accountDrawer.item?.account && <ConfirmButton label="Remove" />}
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={accountDrawer.close}>Cancel</button>
            <button type="submit" className="btn primary">Save</button>
          </>
        }
      >
        {accountDrawer.item && (
          <>
            {accountDrawer.item.account ? (
              <input type="hidden" name="id" value={accountDrawer.item.account.id} />
            ) : (
              <input type="hidden" name="provider_id" value={accountDrawer.item.provider.id} />
            )}
            <AccountFields account={accountDrawer.item.account} divisions={divisions} isAdmin={isAdmin} />
          </>
        )}
      </Drawer>
    </>
  );
}

function AccountFields({
  account,
  divisions,
  isAdmin,
}: {
  account: Account | null;
  divisions: { id: string; name: string }[];
  isAdmin: boolean;
}) {
  return (
    <>
      <div className="grid2">
        <div className="fld">
          <label htmlFor="ac-bank">Bank</label>
          <input id="ac-bank" name="bank" defaultValue={account?.bank ?? ""} placeholder="e.g. BAC" />
        </div>
        <div className="fld">
          <label htmlFor="ac-cur">Currency</label>
          <select id="ac-cur" name="currency" defaultValue={account?.currency ?? "CRC"}>
            <option value="CRC">Colones (₡)</option>
            <option value="USD">US dollars ($)</option>
          </select>
        </div>
      </div>
      <div className="fld">
        <label htmlFor="ac-holder">Account holder</label>
        <input id="ac-holder" name="account_holder" defaultValue={account?.account_holder ?? ""} />
      </div>
      <div className="fld">
        <label htmlFor="ac-num">IBAN or account number</label>
        <input id="ac-num" name="account_number" defaultValue={account?.account_number ?? ""} placeholder="CR05 0152 0200 …" />
      </div>
      {isAdmin && !account && (
        <div className="fld">
          <label htmlFor="ac-div">Who can see it</label>
          <select id="ac-div" name="division_id" defaultValue="">
            <option value="">Admins only</option>
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>{d.name} and admins</option>
            ))}
          </select>
          <span className="hint">Sectors also see an account when they request a payment with it.</span>
        </div>
      )}
    </>
  );
}
