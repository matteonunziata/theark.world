// Plain HTML bar charts: one series, one colour, numbers on the bars, and a
// tooltip on hover. Each chart's list doubles as its table view.

type Row = { label: string; value: number; note?: string };

/** Horizontal bars, biggest first as given. */
export function BarList({ rows, empty }: { rows: Row[]; empty: string }) {
  if (!rows.length || rows.every((r) => !r.value)) {
    if (empty) return <p className="muted" style={{ margin: 0 }}>{empty}</p>;
  }
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="barlist">
      {rows.map((r) => (
        <li key={r.label} title={`${r.label}: ${r.value}${r.note ? ` (${r.note})` : ""}`}>
          <span className="l">{r.label}</span>
          <span className="track">
            <span className="bar" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="v">{r.value}</span>
          {r.note && <span className="n">{r.note}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Vertical columns over time (e.g. per week). */
export function Columns({ rows }: { rows: Row[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const every = Math.ceil(rows.length / 8);
  return (
    <div className="cols" role="table" aria-label="Per week">
      {rows.map((r, i) => (
        <div key={r.label} className="col-c" role="row" title={`Week of ${r.label}: ${r.value}`}>
          <span className="v" role="cell">{r.value || ""}</span>
          <span className="bar" style={{ height: `${(r.value / max) * 100}%` }} />
          <span className="l" role="rowheader">{i % every === 0 ? r.label : ""}</span>
        </div>
      ))}
    </div>
  );
}
