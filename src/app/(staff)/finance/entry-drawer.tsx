"use client";

import { useState } from "react";
import { resizeImage } from "@/components/cover-field";
import { ConfirmButton, Drawer } from "@/components/drawer";
import { PersonPicker } from "@/components/person-picker";
import { useToast } from "@/components/toast";
import {
  CATEGORY_HINTS,
  DOC_KINDS,
  type Entry,
  type Line,
  METHODS,
} from "@/lib/finance";
import { createClient } from "@/lib/supabase/client";
import { saveEntry } from "./actions";

export type DrawerTarget =
  | { entry: Entry }
  | { kind: "income" | "expense"; status?: "paid" | "unpaid"; doc?: string };

type Props = {
  target: DrawerTarget | null;
  lines: Line[];
  currency: string;
  today: string;
  onClose: () => void;
};

/** Remount per target so the form starts fresh each time it opens. */
export function EntryDrawer(props: Props) {
  const t = props.target;
  const key = !t ? "closed" : "entry" in t ? t.entry.id : `${t.kind}-${t.status}-${t.doc}`;
  return <EntryForm key={key} {...props} />;
}

function EntryForm({
  target,
  lines,
  currency,
  today,
  onClose,
}: Props) {
  const e = target && "entry" in target ? target.entry : null;
  const kind = e?.kind ?? (target && "kind" in target ? target.kind : "expense");
  const preset = target && "kind" in target ? target : null;
  const [status, setStatus] = useState(e?.status ?? preset?.status ?? "paid");
  const income = kind === "income";

  return (
    <Drawer
      title={`${e ? "Edit" : "Add"} ${income ? "income" : "expense"}`}
      open={!!target}
      onClose={onClose}
      action={saveEntry}
      footer={
        <>
          {e && <ConfirmButton />}
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary">{e ? "Save" : "Add"}</button>
        </>
      }
    >
      {e && <input type="hidden" name="id" value={e.id} />}
      <input type="hidden" name="kind" value={kind} />
      <div className="grid2">
        <div className="fld">
          <label htmlFor="e-amount">Amount</label>
          <input id="e-amount" name="amount" type="number" min={0} step="any" required defaultValue={e?.amount ?? ""} autoFocus={!e} />
        </div>
        <div className="fld">
          <label htmlFor="e-cur">Currency</label>
          <select id="e-cur" name="currency" defaultValue={e?.currency ?? currency}>
            <option value="CRC">Colones (₡)</option>
            <option value="USD">US dollars ($)</option>
          </select>
        </div>
      </div>
      <div className="grid2">
        <div className="fld">
          <label htmlFor="e-date">Date</label>
          <input id="e-date" name="entry_date" type="date" required defaultValue={e?.entry_date ?? today} />
        </div>
        <div className="fld">
          <label htmlFor="e-line">Business line</label>
          <select id="e-line" name="business_line_id" defaultValue={e?.business_line_id ?? ""}>
            <option value="">Not assigned</option>
            {lines.filter((l) => l.active || l.id === e?.business_line_id).map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid2">
        <div className="fld">
          <label htmlFor="e-party">{income ? "From (customer)" : "To (vendor)"}</label>
          <input id="e-party" name="party" defaultValue={e?.party ?? ""} placeholder={income ? "Who paid" : "Who was paid"} />
        </div>
        <div className="fld">
          <label htmlFor="e-cat">Category</label>
          <input id="e-cat" name="category" list={`cats-${kind}`} defaultValue={e?.category ?? ""} />
          <datalist id={`cats-${kind}`}>
            {CATEGORY_HINTS[income ? "income" : "expense"].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
      </div>
      {income && (
        <PersonPicker
          label="Paid by (a person in the CRM)"
          initial={e?.contact ?? null}
          hint="Optional. Shows on their CRM profile. Tickets and stays are already there, so link those only if they aren’t booked in ARK OS."
        />
      )}
      <div className="fld">
        <label htmlFor="e-desc">Description</label>
        <input id="e-desc" name="description" defaultValue={e?.description ?? ""} placeholder={income ? "e.g. October dues, Ana López" : "e.g. Irrigation parts"} />
      </div>
      <div className="grid2">
        <div className="fld">
          <label htmlFor="e-status">Status</label>
          <select id="e-status" name="status" value={status} onChange={(ev) => setStatus(ev.target.value)}>
            <option value="paid">{income ? "Received" : "Paid"}</option>
            <option value="unpaid">{income ? "Not received yet" : "Not paid yet"}</option>
          </select>
        </div>
        {status === "unpaid" ? (
          <div className="fld">
            <label htmlFor="e-due">Due</label>
            <input id="e-due" name="due_date" type="date" defaultValue={e?.due_date ?? ""} />
          </div>
        ) : (
          <div className="fld">
            <label htmlFor="e-method">Method</label>
            <select id="e-method" name="method" defaultValue={e?.method ?? ""}>
              <option value="">—</option>
              {METHODS.map(([k, n]) => (
                <option key={k} value={k}>{n}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="subhead">Receipt or invoice</div>
      <div className="grid2">
        <div className="fld">
          <label htmlFor="e-doc">Document</label>
          <select id="e-doc" name="doc_kind" defaultValue={e?.doc_kind ?? preset?.doc ?? (income ? "" : "receipt")}>
            <option value="">None</option>
            {DOC_KINDS.map(([k, n]) => (
              <option key={k} value={k}>{n}</option>
            ))}
          </select>
        </div>
        <div className="fld">
          <label htmlFor="e-ref">Number</label>
          <input id="e-ref" name="reference" defaultValue={e?.reference ?? ""} placeholder="Invoice or receipt no." />
        </div>
      </div>
      <FileField path={e?.file_path} name={e?.file_name} />
    </Drawer>
  );
}

/** Upload a receipt/invoice (photo or PDF) to the private finance bucket. */
export function FileField({ path: initialPath, name: initialName }: { path?: string | null; name?: string | null }) {
  const [path, setPath] = useState(initialPath ?? "");
  const [name, setName] = useState(initialName ?? "");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function upload(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      toast("That file is over 10 MB. Try a smaller photo or PDF.");
      return;
    }
    setBusy(true);
    try {
      const isImage = file.type.startsWith("image/");
      const body = isImage ? await resizeImage(file, 2200) : file;
      const ext = isImage ? "jpg" : (file.name.split(".").pop() ?? "pdf").toLowerCase();
      const p = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
      const { error } = await createClient()
        .storage.from("finance")
        .upload(p, body, { contentType: isImage ? "image/jpeg" : file.type || "application/pdf" });
      if (error) throw error;
      setPath(p);
      setName(file.name);
    } catch {
      toast("Couldn’t upload that file. Try a photo or PDF under 10 MB.");
    }
    setBusy(false);
  }

  return (
    <div className="fld">
      <input type="hidden" name="file_path" value={path} />
      <input type="hidden" name="file_name" value={name} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {path && (
          <button type="button" className="btn" onClick={() => openFile(path)}>
            View {name || "file"}
          </button>
        )}
        <label className="btn" style={{ cursor: "pointer" }}>
          {busy ? "Uploading…" : path ? "Replace file" : "Attach photo or PDF"}
          <input type="file" accept="image/*,application/pdf" hidden onChange={(ev) => ev.target.files?.[0] && upload(ev.target.files[0])} />
        </label>
        {path && (
          <button type="button" className="btn ghost" onClick={() => { setPath(""); setName(""); }}>
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

/** Files are private; open them through a link that expires in a minute. */
export async function openFile(path: string) {
  const w = window.open("", "_blank");
  const { data } = await createClient().storage.from("finance").createSignedUrl(path, 60);
  if (data?.signedUrl && w) w.location.href = data.signedUrl;
  else w?.close();
}
