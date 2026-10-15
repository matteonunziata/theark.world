"use client";

import { courtMoney, type EquipmentPick, type PriceItem } from "@/lib/courts";

/** Equipment for one person, with a price each. Whoever takes it pays for it. */
export function EquipmentPicker({
  items,
  picks,
  onChange,
  label = "Equipment",
}: {
  items: PriceItem[];
  picks: EquipmentPick[];
  onChange: (picks: EquipmentPick[]) => void;
  label?: string;
}) {
  const list = items.filter((i) => i.kind === "equipment");
  if (!list.length) return null;
  const qty = (key: string) => picks.find((p) => p.key === key)?.qty ?? 0;
  const set = (key: string, n: number) => {
    const next = picks.filter((p) => p.key !== key);
    if (n > 0) next.push({ key, qty: n });
    onChange(next);
  };
  return (
    <fieldset className="eq">
      <legend>{label}</legend>
      {list.map((i) => (
        <div key={i.key} className="eq-row">
          <span>
            {i.label} <small>{courtMoney(i.price, "CRC")}</small>
          </span>
          <span className="eq-step">
            <button type="button" aria-label={`Fewer ${i.label}`} disabled={qty(i.key) === 0} onClick={() => set(i.key, qty(i.key) - 1)}>
              −
            </button>
            <b>{qty(i.key)}</b>
            <button type="button" aria-label={`More ${i.label}`} disabled={qty(i.key) >= 10} onClick={() => set(i.key, qty(i.key) + 1)}>
              +
            </button>
          </span>
        </div>
      ))}
    </fieldset>
  );
}
