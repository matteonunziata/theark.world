// Plain charts for the staff app: one series, one colour, numbers on the
// marks and a tooltip on hover. Lists double as the table view; the SVG
// time series is for money over time, where the numbers need an axis.

export type ChartRow = { label: string; value: number; note?: string };

const same = (n: number) => String(n);

/** Horizontal bars, in the order given (biggest first reads best). */
export function BarList({
  rows,
  empty,
  format = same,
}: {
  rows: ChartRow[];
  empty: string;
  format?: (n: number) => string;
}) {
  if (!rows.length || rows.every((r) => !r.value)) {
    if (empty) return <p className="muted" style={{ margin: 0 }}>{empty}</p>;
  }
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="barlist">
      {rows.map((r) => (
        <li key={r.label} title={`${r.label}: ${format(r.value)}${r.note ? ` (${r.note})` : ""}`}>
          <span className="l">{r.label}</span>
          <span className="track">
            <span className="bar" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="v">{format(r.value)}</span>
          {r.note && <span className="n">{r.note}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Vertical columns over an ordered axis (weeks, hours). Counts, not money. */
export function Columns({ rows, label = "Per week" }: { rows: ChartRow[]; label?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const every = Math.ceil(rows.length / 8);
  return (
    <div className="cols" role="table" aria-label={label}>
      {rows.map((r, i) => (
        <div key={r.label} className="col-c" role="row" title={`${r.label}: ${r.value}${r.note ? ` (${r.note})` : ""}`}>
          <span className="v" role="cell">{r.value || ""}</span>
          <span className="bar" style={{ height: `${(r.value / max) * 100}%` }} />
          <span className="l" role="rowheader">{i % every === 0 ? r.label : ""}</span>
        </div>
      ))}
    </div>
  );
}

/** A round number at or above n for the top of an axis: 1, 2, 2.5, 5 × 10ⁿ. */
export function niceMax(n: number) {
  if (!(n > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(n));
  const f = n / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

/**
 * Columns over time with a money axis: gridlines at 0, half and the top,
 * labels every few columns, and the exact figure in each column's tooltip.
 */
export function TimeSeries({
  rows,
  format,
  axis = format,
  label,
}: {
  rows: ChartRow[];
  format: (n: number) => string;
  axis?: (n: number) => string;
  label: string;
}) {
  const W = 640;
  const H = 210;
  const padL = 48;
  const padR = 6;
  const padT = 12;
  const padB = 24;
  const top = niceMax(Math.max(...rows.map((r) => r.value), 0));
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const n = Math.max(1, rows.length);
  const slot = innerW / n;
  const gap = Math.min(6, slot * 0.25);
  const every = Math.ceil(n / 8);
  const y = (v: number) => padT + innerH - (v / top) * innerH;
  const grid = [0, 0.5, 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="ts">
      {grid.map((g) => (
        <g key={g}>
          <line x1={padL} x2={W - padR} y1={y(top * g)} y2={y(top * g)} stroke="var(--line)" strokeWidth={1} />
          <text x={padL - 6} y={y(top * g) + 4} textAnchor="end" fontSize={11} fill="var(--muted)" fontFamily="inherit">
            {axis(top * g)}
          </text>
        </g>
      ))}
      {rows.map((r, i) => {
        const x = padL + i * slot + gap / 2;
        const h = (r.value / top) * innerH;
        return (
          <g key={r.label + i}>
            <rect x={x} y={y(r.value)} width={Math.max(1, slot - gap)} height={Math.max(h, r.value > 0 ? 1.5 : 0)} rx={Math.min(3, slot / 4)} fill="var(--leaf)">
              <title>{`${r.label}: ${format(r.value)}${r.note ? ` (${r.note})` : ""}`}</title>
            </rect>
            {i % every === 0 && (
              <text x={x + (slot - gap) / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--muted)" fontFamily="inherit">
                {r.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
