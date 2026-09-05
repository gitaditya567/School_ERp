import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Panel, Kpi, Chip, Loading, ErrorBox, Empty, Bar } from '../components/ui';
import { RS, fmtDate, downloadCSV } from '../lib/format';

export default function Concessions() {
  const { can } = useAuth();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = () => { setError(null); api.get('/concessions').then(setData).catch(setError); };
  useEffect(() => { document.title = 'Concession Register'; load(); }, []);

  if (error) return <ErrorBox error={error} onRetry={load} />;
  if (!data) return <Loading />;
  const { concessions: rows, total, byReason, students } = data;
  const top = Object.entries(byReason).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="stack">
      <div className="kpis">
        <Kpi accent label="Total concession" value={RS(total)} foot={<span>{rows.length} entries</span>} />
        <Kpi label="Students benefited" value={students} foot={<span>across all classes</span>} />
        <Kpi label="Largest reason" value={<span style={{ fontSize: 19 }}>{top?.[0] || '—'}</span>} foot={<span>{RS(top?.[1] || 0)}</span>} />
        <Kpi label="Entries this register" value={rows.length} foot={<span>every one with a reason and approver</span>} />
      </div>

      <Panel bodyless title="Concession & Discount Register" sub="Every discount is stored with its reason and approver — audit ready"
        actions={can('export') && rows.length > 0 && (
          <button type="button" className="btn btn-sm" onClick={() => downloadCSV('concessions.csv',
            ['Date', 'Student', 'Class', 'Instalment', 'Reason', 'Approved by', 'Receipt', 'Amount'],
            rows.map((d) => [fmtDate(d.date), d.student?.name, d.classId?.name, d.instNo, d.reason,
              d.approvedBy?.name, d.receipt?.receiptNo || '—', d.amount]))}>Export CSV</button>
        )}>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Date</th><th>Student</th><th>Class</th><th>Inst.</th><th>Reason</th><th>Approved by</th><th>Receipt</th><th className="t-right">Amount</th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={8}><Empty>No concession granted yet.</Empty></td></tr>}
              {rows.map((d) => (
                <tr key={d._id} className="clickable" onClick={() => d.student && nav(`/students/${d.student._id}`)}>
                  <td className="tiny nw">{fmtDate(d.date)}</td>
                  <td style={{ fontWeight: 600 }}>{d.student?.name}</td>
                  <td><span className="tag">{d.classId?.name}</span></td>
                  <td><b className="mono">{d.instNo}</b></td>
                  <td><Chip tone="disc">{d.reason}</Chip></td>
                  <td className="tiny">{d.approvedBy?.name}</td>
                  <td className="mono tiny">{d.receipt?.receiptNo || '—'}</td>
                  <td className="num" style={{ fontWeight: 700, color: 'var(--brand)' }}>{RS(d.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr style={{ background: 'var(--surface-2)' }}><td colSpan={7} style={{ fontWeight: 700 }}>Total</td>
              <td className="num" style={{ fontWeight: 700 }}>{RS(total)}</td></tr></tfoot>
          </table>
        </div>
      </Panel>

      {rows.length > 0 && (
        <Panel title="Reason-wise">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14 }}>
            {Object.entries(byReason).sort((a, b) => b[1] - a[1]).map(([r, v]) => (
              <div key={r}>
                <div className="lbl">{r}</div>
                <div className="mono" style={{ fontSize: 17, fontWeight: 700 }}>{RS(v)}</div>
                <div style={{ marginTop: 5 }}><Bar pct={(v / total) * 100} color="var(--brand)" /></div>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
