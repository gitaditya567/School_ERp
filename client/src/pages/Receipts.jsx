import { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Panel, Kpi, Chip, Loading, ErrorBox, Empty, Input, Select, Bar } from '../components/ui';
import ReceiptView from './ReceiptView';
import { RS, fmtDate, downloadCSV } from '../lib/format';

const MODES = ['UPI', 'Bank Transfer (NEFT/IMPS)', 'Cheque', 'Demand Draft', 'Cash (at office)', 'Card'];

export default function Receipts() {
  const { can } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [f, setF] = useState({ search: '', from: '', to: '', mode: '' });
  const [open, setOpen] = useState(null);

  const load = () => { setError(null); api.get('/receipts', { params: f }).then(setData).catch(setError); };
  useEffect(() => { document.title = 'Receipt Register'; }, []);
  useEffect(() => { const t = setTimeout(load, 220); return () => clearTimeout(t); }, [f.search, f.from, f.to, f.mode]);

  if (error) return <ErrorBox error={error} onRetry={load} />;
  if (!data) return <Loading />;
  const { receipts, totals, nextReceiptNo } = data;

  return (
    <div className="stack">
      <div className="kpis">
        <Kpi label="Receipts" value={totals.count} foot={<span>Next number {nextReceiptNo}</span>} />
        <Kpi accent label="Total collected" value={RS(totals.total)} foot={<span>Filtered range</span>} />
        <Kpi label="Discount given" value={RS(totals.discount)} color="var(--brand)" foot={<span>In the concession register</span>} />
        <Kpi label="Late fee collected" value={RS(totals.lateFee)} color="var(--warn)" foot={<span>Per the late-fee rule</span>} />
      </div>

      <Panel bodyless title="Receipt Register" sub="Cancelled receipts keep their number — it is never reused"
        actions={(
          <>
            <Input style={{ width: 170 }} placeholder="Receipt no." value={f.search} onChange={(e) => setF({ ...f, search: e.target.value })} />
            <label className="row" style={{ gap: 5 }}><span className="lbl">From</span>
              <Input type="date" style={{ width: 'auto' }} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
            <label className="row" style={{ gap: 5 }}><span className="lbl">To</span>
              <Input type="date" style={{ width: 'auto' }} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
            <Select style={{ width: 'auto' }} value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}>
              <option value="">All modes</option>{MODES.map((m) => <option key={m}>{m}</option>)}
            </Select>
            {can('export') && receipts.length > 0 && (
              <button type="button" className="btn btn-sm" onClick={() => downloadCSV('receipts.csv',
                ['Receipt No', 'Date', 'Student', 'Class', 'Instalments', 'Mode', 'Gross', 'Discount', 'Late', 'Received', 'Status'],
                receipts.map((r) => [r.receiptNo, fmtDate(r.date), r.student?.name, r.classId?.name,
                  r.lines.map((l) => l.instNo).join(' '), r.mode, r.gross, r.discount, r.lateFee, r.total,
                  r.cancelled?.at ? 'Cancelled' : 'Valid']))}>Export CSV</button>
            )}
          </>
        )}>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr><th>Receipt No</th><th>Date</th><th>Student</th><th>Class</th><th>Instalments</th><th>Mode</th><th>By</th>
                <th className="t-right">Gross</th><th className="t-right">Disc.</th><th className="t-right">Late</th><th className="t-right">Received</th></tr>
            </thead>
            <tbody>
              {receipts.length === 0 && <tr><td colSpan={11}><Empty>No receipts in this range.</Empty></td></tr>}
              {receipts.map((r) => (
                <tr key={r._id} className="clickable" onClick={() => setOpen(r._id)}
                  style={r.cancelled?.at ? { opacity: 0.55 } : undefined}>
                  <td className="mono" style={{ color: 'var(--brand)', fontWeight: 600 }}>
                    {r.receiptNo}{r.cancelled?.at && <div><Chip tone="over">Cancelled</Chip></div>}
                  </td>
                  <td className="tiny nw">{fmtDate(r.date)}</td>
                  <td style={{ fontWeight: 600 }}>{r.student?.name}</td>
                  <td><span className="tag">{r.classId?.name}</span></td>
                  <td className="mono tiny">{r.lines.map((l) => l.instNo).join(', ')}</td>
                  <td className="tiny">{r.mode}</td>
                  <td className="tiny muted">{r.collectedBy?.name}</td>
                  <td className="num">{RS(r.gross)}</td>
                  <td className="num" style={{ color: 'var(--brand)' }}>{r.discount ? `−${RS(r.discount)}` : '—'}</td>
                  <td className="num">{r.lateFee ? RS(r.lateFee) : '—'}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{RS(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {Object.keys(totals.byMode).length > 0 && (
        <Panel title="Mode-wise breakup" sub="For bank reconciliation">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
            {Object.entries(totals.byMode).sort((a, b) => b[1] - a[1]).map(([m, v]) => (
              <div key={m}>
                <div className="lbl">{m}</div>
                <div className="mono" style={{ fontSize: 17, fontWeight: 700 }}>{RS(v)}</div>
                <div style={{ marginTop: 5 }}><Bar pct={(v / totals.total) * 100} color="var(--teal)" /></div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {open && <ReceiptView id={open} onClose={() => setOpen(null)} onChanged={load} />}
    </div>
  );
}
