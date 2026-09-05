import { useState } from 'react';
import { RS } from '../lib/format';

const kfmt = (v) => (v >= 100000 ? `${(v / 100000).toFixed(v % 100000 ? 1 : 0)}L`
  : v >= 1000 ? `${Math.round(v / 1000)}k` : String(v));
const niceTop = (max) => {
  if (max <= 0) return 100;
  const step = 10 ** (String(Math.round(max)).length - 1);
  return Math.ceil(max / step) * step;
};

export function CashFlowChart({ series, labels, mode = 'both' }) {
  const [hover, setHover] = useState(series.length - 1);
  const W = 580; const H = 210;
  const pad = { l: 56, r: 10, t: 14, b: 30 };
  const rows = mode === 'net'
    ? [{ key: 'net', fill: 'var(--good)', values: series.map((s) => s.collection - s.expense) }]
    : [
      { key: 'collection', fill: 'var(--brand)', values: series.map((s) => s.collection) },
      { key: 'expense', fill: 'var(--teal)', op: 0.62, values: series.map((s) => s.expense) },
    ];
  const top = niceTop(Math.max(...rows.flatMap((r) => r.values.map(Math.abs)), 1));
  const iw = W - pad.l - pad.r; const ih = H - pad.t - pad.b; const bw = iw / series.length;
  const y = (v) => pad.t + ih - (Math.max(0, v) / top) * ih;
  const cur = series[hover] || series[series.length - 1];

  return (
    <>
      <div className="chart-read">
        <b>{labels[hover]}</b>
        <span><i style={{ background: 'var(--brand)' }} />Collection <b className="mono">{RS(cur?.collection)}</b></span>
        <span><i style={{ background: 'var(--teal)' }} />Expense <b className="mono">{RS(cur?.expense)}</b></span>
        <span><i style={{ background: 'var(--good)' }} />Net <b className="mono">{RS((cur?.collection || 0) - (cur?.expense || 0))}</b></span>
      </div>
      <svg id="colChart" viewBox={`0 0 ${W} ${H}`} width="100%" height="210" role="img"
        aria-label="Month-wise fee collection and expenses">
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const yy = pad.t + ih - f * ih;
          return (
            <g key={f}>
              <line x1={pad.l} x2={W - pad.r} y1={yy} y2={yy} stroke="var(--line)" strokeWidth="1" />
              <text x={pad.l - 9} y={yy + 3.5} textAnchor="end" fontSize="9.5"
                fontFamily="IBM Plex Mono, monospace" fill="var(--text-3)">{kfmt(Math.round(f * top))}</text>
            </g>
          );
        })}
        {series.map((s, i) => {
          const x = pad.l + i * bw;
          const n = rows.length; const gw = bw * 0.62; const cw = gw / n - (n > 1 ? 4 : 0); const x0 = x + (bw - gw) / 2;
          return (
            <g key={s.month} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0}>
              <rect x={x} y={pad.t} width={bw} height={ih} fill="transparent" style={{ cursor: 'crosshair' }} />
              {rows.map((r, j) => (
                <rect key={r.key} className="cbar" x={x0 + j * (cw + 4)} y={y(r.values[i])}
                  width={cw} height={Math.max(1, pad.t + ih - y(r.values[i]))} rx="3"
                  fill={r.fill} opacity={hover === i ? (r.op ?? 1) : (r.op ?? 1) * 0.45} />
              ))}
              <text x={x + bw / 2} y={H - 9} textAnchor="middle" fontSize="10"
                fontFamily="Public Sans, sans-serif" fill="var(--text-3)">{labels[i]?.split(' ')[0]}</text>
            </g>
          );
        })}
      </svg>
    </>
  );
}

export function Donut({ pct, color = 'var(--brand)', caption = 'collected' }) {
  const r = 46; const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 120 120" width="132" height="132" role="img" aria-label={`${pct} percent ${caption}`}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="13" />
      <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="13" strokeLinecap="round"
        strokeDasharray={`${(c * pct) / 100} ${c}`} transform="rotate(-90 60 60)" />
      <text x="60" y="56" textAnchor="middle" fontFamily="Archivo, sans-serif" fontWeight="700" fontSize="26" fill="var(--text)">{pct}%</text>
      <text x="60" y="74" textAnchor="middle" fontFamily="Public Sans, sans-serif" fontSize="10.5" fill="var(--text-3)">{caption}</text>
    </svg>
  );
}

export function Sparkline({ values, color = 'var(--brand)' }) {
  if (!values?.length) return null;
  const W = 104; const H = 26; const max = Math.max(...values, 1);
  const pts = values.map((v, i) => [(i * W) / Math.max(1, values.length - 1), H - 2 - (v / max) * (H - 5)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
      <path d={`${d} L${W} ${H} L0 ${H} Z`} fill={color} opacity=".14" />
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx={last[0].toFixed(1)} cy={last[1].toFixed(1)} r="2.6" fill={color} />
    </svg>
  );
}
