"use client";

import { useState } from "react";
import { Drawer } from "@/components/drawer";
import { FIELD_LABELS, IMPORT_MAX, parseCsv, toContacts } from "@/lib/csv";
import { PTYPES } from "@/lib/crm";
import { importContacts } from "../actions";

type Parsed = ReturnType<typeof toContacts> & { file: string };

const TEMPLATE =
  "First name,Last name,Email,Phone,Instagram,Location,Source,Interests,Type,Notes\n" +
  "Ana,Mora,ana@example.com,+506 8888 0000,anamora,San José,Friend/Referral,\"yoga, surf\",contact,Met at the market\n";

export function ImportDrawer({
  open,
  onClose,
  type,
}: {
  open: boolean;
  onClose: () => void;
  type: string;
}) {
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [readError, setReadError] = useState("");

  async function onFile(file: File | undefined) {
    setParsed(null);
    setReadError("");
    if (!file) return;
    if (file.size > 5_000_000) return setReadError("That file is over 5MB. Split it into smaller files.");
    const result = toContacts(parseCsv(await file.text()));
    if (!result.map.some((f) => f === "name" || f === "first_name" || f === "email")) {
      return setReadError(
        "We couldn’t find a name or email column. The first row should be headers, like “Name” and “Email”.",
      );
    }
    setParsed({ ...result, file: file.name });
  }

  const close = () => {
    setParsed(null);
    setReadError("");
    onClose();
  };
  const tooMany = (parsed?.ok.length ?? 0) > IMPORT_MAX;
  const n = parsed?.ok.length ?? 0;

  return (
    <Drawer
      title="Import from CSV"
      open={open}
      onClose={close}
      action={importContacts}
      footer={
        <>
          <button type="button" className="btn" onClick={close}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={!n || tooMany}>
            {n ? `Add ${n.toLocaleString()} ${n === 1 ? "person" : "people"}` : "Add people"}
          </button>
        </>
      }
    >
      <p className="note" style={{ marginTop: 0 }}>
        Export a sheet as CSV with a header row. We match columns like Name, First name, Last name,
        Email, Phone or WhatsApp, Instagram, Location, Source, Interests, Type and Notes. Anyone whose
        email is already in the CRM is left as they are.{" "}
        <a
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`}
          download="ark-contacts-template.csv"
        >
          Download a template
        </a>
      </p>

      <div className="fld" style={{ marginTop: 16 }}>
        <label htmlFor="imp-file">CSV file</label>
        <input
          id="imp-file"
          type="file"
          accept=".csv,text/csv,.tsv,text/tab-separated-values,.txt"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </div>
      {readError && (
        <div className="form-error" role="alert">
          {readError}
        </div>
      )}

      {parsed && (
        <>
          <div className="fld">
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>Columns</span>
            <ul className="imp-cols">
              {parsed.headers.map((h, i) => (
                <li key={i}>
                  <span>{h || <span className="muted">(blank)</span>}</span>
                  <span className={parsed.map[i] ? "" : "muted"}>
                    {parsed.map[i] ? `→ ${FIELD_LABELS[parsed.map[i]]}` : "ignored"}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {n > 0 && (
            <div className="fld">
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>
                First {Math.min(5, n)} of {n.toLocaleString()}
              </span>
              <ul className="imp-cols">
                {parsed.ok.slice(0, 5).map((r, i) => (
                  <li key={i}>
                    <b>{r.name}</b>
                    <span className="muted" style={{ overflowWrap: "anywhere" }}>
                      {r.email ?? r.phone ?? "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tooMany && (
            <div className="form-error" role="alert">
              That’s {n.toLocaleString()} people. Up to {IMPORT_MAX.toLocaleString()} at a time, so split the
              file and import each part.
            </div>
          )}

          {parsed.problems.length > 0 && (
            <details className="fld">
              <summary style={{ cursor: "pointer", fontSize: 13.5, fontWeight: 600 }}>
                {parsed.problems.length} {parsed.problems.length === 1 ? "row" : "rows"} will be skipped
              </summary>
              <ul className="imp-cols">
                {parsed.problems.slice(0, 50).map((p) => (
                  <li key={p.line}>
                    <span>Row {p.line}</span>
                    <span className="muted">{p.reason}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <input type="hidden" name="rows" value={JSON.stringify(parsed.ok)} />

          <div className="fld">
            <label htmlFor="imp-type">Add as</label>
            <select id="imp-type" name="type" defaultValue={type || "contact"}>
              {PTYPES.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
            <span className="hint">Used when a row has no Type column.</span>
          </div>
          <div className="fld">
            <label htmlFor="imp-source">Source</label>
            <input
              id="imp-source"
              name="source"
              defaultValue={parsed.file.replace(/\.(csv|tsv|txt)$/i, "")}
              maxLength={120}
            />
            <span className="hint">Used when a row has no Source, so you can find this batch later.</span>
          </div>
        </>
      )}
    </Drawer>
  );
}
