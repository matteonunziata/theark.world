"use client";

import { ConfirmButton, Drawer, useDrawer } from "@/components/drawer";
import type { Tables } from "@/lib/database.types";
import { fmtDate } from "@/lib/dates";
import { saveHomework } from "./actions";

type Item = Tables<"school_homework">;

export function HomeworkTab({ items, groups, today }: { items: Item[]; groups: string[]; today: string }) {
  const drawer = useDrawer<Item>();
  const open = items.filter((h) => !h.due_on || h.due_on >= today);
  const past = items.filter((h) => h.due_on && h.due_on < today);

  const row = (h: Item) => (
    <button key={h.id} type="button" className="hw-row" onClick={() => drawer.openItem(h)}>
      <span className="due">
        {h.due_on ? fmtDate(h.due_on, { weekday: "short", month: "short", day: "numeric" }) : "No due date"}
      </span>
      <span className="what">
        <b>{h.title}</b>
        {h.details && <span className="muted">{h.details}</span>}
      </span>
      <span className="tag-sm">{h.group_name ?? "All groups"}</span>
    </button>
  );

  return (
    <>
      <div className="toolbar">
        <span className="muted" style={{ fontSize: 13.5 }}>What’s going home with each group.</span>
        <button type="button" className="btn primary" style={{ marginLeft: "auto" }} onClick={drawer.openNew}>
          Set homework
        </button>
      </div>
      {!items.length ? (
        <div className="empty">
          <h2>No homework set</h2>
          <p>Add what each group takes home, with a due date.</p>
          <button type="button" className="btn primary" onClick={drawer.openNew}>Set the first homework</button>
        </div>
      ) : (
        <>
          <div className="hw-list">
            {open.length ? open.map(row) : <p className="muted">Nothing due.</p>}
          </div>
          {past.length > 0 && (
            <>
              <div className="subhead" style={{ marginTop: 22 }}>Earlier</div>
              <div className="hw-list past">{past.map(row)}</div>
            </>
          )}
        </>
      )}

      <Drawer
        key={drawer.item?.id ?? "new"}
        title={drawer.item ? "Edit homework" : "Set homework"}
        open={drawer.open}
        onClose={drawer.close}
        action={saveHomework}
        footer={
          <>
            {drawer.item && <ConfirmButton label="Remove" />}
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={drawer.close}>Cancel</button>
            <button type="submit" className="btn primary">Save</button>
          </>
        }
      >
        {drawer.item && <input type="hidden" name="id" value={drawer.item.id} />}
        <div className="fld">
          <label htmlFor="hw-title">What</label>
          <input id="hw-title" name="title" required defaultValue={drawer.item?.title ?? ""} placeholder="e.g. Nature journal, week 8" />
        </div>
        <div className="fld">
          <label htmlFor="hw-details">Details</label>
          <textarea id="hw-details" name="details" rows={3} defaultValue={drawer.item?.details ?? ""} />
        </div>
        <div className="grid2">
          <div className="fld">
            <label htmlFor="hw-group">Group</label>
            <input id="hw-group" name="group_name" list="hw-groups" defaultValue={drawer.item?.group_name ?? ""} placeholder="Leave empty for all" />
            <datalist id="hw-groups">
              {groups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </div>
          <div className="fld">
            <label htmlFor="hw-due">Due</label>
            <input id="hw-due" name="due_on" type="date" defaultValue={drawer.item?.due_on ?? ""} />
          </div>
        </div>
        <input type="hidden" name="assigned_on" value={drawer.item?.assigned_on ?? today} />
      </Drawer>
    </>
  );
}
