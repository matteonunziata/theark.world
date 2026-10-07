"use client";

import { useState } from "react";
import { ConfirmButton, Drawer } from "@/components/drawer";
import { useToast } from "@/components/toast";
import type { Tables } from "@/lib/database.types";
import { orderQty, qty, STOCK_CATEGORIES, stockLevel } from "@/lib/hospitality";
import { countInventoryItem, saveInventoryItem } from "../../actions";

type Item = Tables<"inventory_items">;

const LEVEL = { out: "Out", low: "Low", ok: "OK" } as const;

export function InventoryView({ items }: { items: Item[] }) {
  const toast = useToast();
  const [editing, setEditing] = useState<Item | null>(null);
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);
  const [q, setQ] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);

  const edit = (i: Item | null) => {
    setEditing(i);
    setKey((k) => k + 1);
    setOpen(true);
  };

  const needs = items.filter((i) => stockLevel(i) !== "ok");
  const bySupplier = new Map<string, Item[]>();
  for (const i of needs) bySupplier.set(i.supplier ?? "No supplier set", [...(bySupplier.get(i.supplier ?? "No supplier set") ?? []), i]);

  const orderText = [...bySupplier]
    .map(([s, rows]) => `${s}\n${rows.map((i) => `- ${i.name}: ${qty(orderQty(i))} ${i.unit}`).join("\n")}`)
    .join("\n\n");

  const shown = items.filter(
    (i) => (!onlyLow || stockLevel(i) !== "ok") && i.name.toLowerCase().includes(q.trim().toLowerCase()),
  );
  const cats = new Map<string, Item[]>();
  for (const i of shown) cats.set(i.category, [...(cats.get(i.category) ?? []), i]);

  return (
    <>
      <div className="listings-h">
        <p className="muted" style={{ margin: 0 }}>
          {items.length
            ? `${items.length} item${items.length === 1 ? "" : "s"}, ${needs.length} low or out.`
            : "What’s in the kitchen and when to reorder."}
        </p>
        <span className="spacer" />
        <input type="search" aria-label="Search inventory" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 160 }} />
        <label className="check">
          <input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} />
          Low or out only
        </label>
        <button type="button" className="btn primary sm" onClick={() => edit(null)}>Add item</button>
      </div>

      {needs.length > 0 && (
        <section>
          <h2 className="section-title">
            To order
            <span className="muted"> · back up to the stock-up level</span>
          </h2>
          <div className="table-wrap">
            <table className="lines-table">
              <thead>
                <tr><th>Item</th><th>On hand</th><th>Order</th></tr>
              </thead>
              {[...bySupplier].map(([supplier, rows]) => (
                <tbody key={supplier}>
                  <tr className="clean-area" style={{ background: "none" }}>
                    <td colSpan={3} style={{ fontWeight: 700, color: "var(--muted)", fontSize: 13 }}>{supplier}</td>
                  </tr>
                  {rows.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <button type="button" className="linkish" onClick={() => edit(i)}>{i.name}</button>
                      </td>
                      <td>{qty(i.on_hand)} {i.unit}</td>
                      <td><strong>{qty(orderQty(i))} {i.unit}</strong></td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
          <p style={{ marginTop: -12, marginBottom: 22 }}>
            <button
              type="button"
              className="btn sm"
              onClick={() => navigator.clipboard.writeText(orderText).then(() => toast("Order list copied"), () => toast("Couldn’t copy the list"))}
            >
              Copy order list
            </button>
          </p>
        </section>
      )}

      {items.length === 0 ? (
        <p className="muted" style={{ marginBottom: 22 }}>
          Nothing here yet. Add an item with how much is on hand, the level where it counts as low, and the level to stock back up to.
        </p>
      ) : shown.length === 0 ? (
        <p className="muted">Nothing matches.</p>
      ) : (
        [...cats].map(([cat, rows]) => (
          <section key={cat}>
            <h2 className="section-title">{cat}</h2>
            <div className="table-wrap">
              <table className="lines-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Status</th>
                    <th>Low at</th>
                    <th>Stock up to</th>
                    <th>Supplier</th>
                    <th>On hand</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((i) => {
                    const lvl = stockLevel(i);
                    return (
                      <tr key={i.id}>
                        <td>
                          <button type="button" className="linkish" onClick={() => edit(i)}>{i.name}</button>
                        </td>
                        <td>
                          <span className={`tag-sm ${lvl === "ok" ? "" : lvl}`} style={{ margin: 0 }}>{LEVEL[lvl]}</span>
                        </td>
                        <td className="muted">{qty(i.reorder_at)} {i.unit}</td>
                        <td className="muted">{Number(i.target) > 0 ? `${qty(i.target)} ${i.unit}` : "—"}</td>
                        <td className="muted">{i.supplier ?? "—"}</td>
                        <td>
                          <form action={countInventoryItem} className="stock-qty">
                            <input type="hidden" name="id" value={i.id} />
                            <input
                              name="on_hand"
                              type="number"
                              inputMode="decimal"
                              min={0}
                              step="any"
                              defaultValue={qty(i.on_hand)}
                              aria-label={`${i.name} on hand, ${i.unit}`}
                            />
                            <button type="submit" className="btn sm">Update</button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}

      <Drawer
        key={key}
        title={editing ? "Edit item" : "Add an item"}
        open={open}
        onClose={() => setOpen(false)}
        action={saveInventoryItem}
        footer={
          <>
            {editing && <ConfirmButton />}
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="btn primary">Save</button>
          </>
        }
      >
        {editing && <input type="hidden" name="id" value={editing.id} />}
        <div className="fld">
          <label htmlFor="iv-name">Name</label>
          <input id="iv-name" name="name" required defaultValue={editing?.name ?? ""} placeholder="Black beans" />
        </div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="iv-cat">Category</label>
            <select id="iv-cat" name="category" defaultValue={editing?.category ?? "Other"}>
              {[...new Set([...STOCK_CATEGORIES, editing?.category ?? "Other"])].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="fld">
            <label htmlFor="iv-unit">Counted in</label>
            <input id="iv-unit" name="unit" defaultValue={editing?.unit ?? ""} placeholder="kg, bottles, trays" />
          </div>
        </div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="iv-on">On hand</label>
            <input id="iv-on" name="on_hand" type="number" inputMode="decimal" min={0} step="any" defaultValue={editing ? qty(editing.on_hand) : "0"} />
          </div>
          <div className="fld">
            <label htmlFor="iv-low">Low at</label>
            <input id="iv-low" name="reorder_at" type="number" inputMode="decimal" min={0} step="any" defaultValue={editing ? qty(editing.reorder_at) : "0"} />
          </div>
        </div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="iv-target">Stock up to</label>
            <input id="iv-target" name="target" type="number" inputMode="decimal" min={0} step="any" defaultValue={editing ? qty(editing.target) : "0"} />
          </div>
          <div className="fld">
            <label htmlFor="iv-sup">Supplier</label>
            <input id="iv-sup" name="supplier" defaultValue={editing?.supplier ?? ""} />
          </div>
        </div>
        <p className="muted" style={{ fontSize: 13.5, margin: "-4px 0 14px" }}>
          An item shows as low once it’s at or below “Low at”. The order list suggests enough to get back to “Stock up to”.
        </p>
        <div className="fld">
          <label htmlFor="iv-notes">Notes</label>
          <textarea id="iv-notes" name="notes" rows={3} defaultValue={editing?.notes ?? ""} />
        </div>
      </Drawer>
    </>
  );
}
