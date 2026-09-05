import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Panel, Chip, Loading, ErrorBox, Empty, Bar } from '../components/ui';
import StudentPhotoPicker from '../components/StudentPhotoPicker';
import ReceiptView from './ReceiptView';
import { RS, fmtDate, initials, statusOf } from '../lib/format';

export default function StudentProfile() {
  const { id } = useParams();
  const nav = useNavigate();
  const { can } = useAuth();
  const { toast, error: shout } = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [receiptId, setReceiptId] = useState(null);
  const [editingPhoto, setEditingPhoto] = useState(false);

  const load = () => { setError(null); api.get(`/students/${id}`).then(setData).catch(setError); };
  useEffect(() => { document.title = 'Student Ledger'; load(); }, [id]);

  if (error) return <ErrorBox error={error} onRetry={load} />;
  if (!data) return <Loading />;
  const { student: s, ledger, receipts, totals } = data;

  const updatePhoto = async (newPhoto) => {
    try {
      await api.patch(`/students/${s._id}`, { photo: newPhoto });
      toast('Student photo updated');
      load();
    } catch (e) {
      shout(e);
    }
  };

  return (
    <div className="stack">
      <Panel bodyless>
        <div className="panel-head" style={{ alignItems: 'flex-start' }}>
          <div style={{ position: 'relative' }}>
            {s.photo ? (
              <img
                src={s.photo}
                alt={s.name}
                style={{ width: 52, height: 52, borderRadius: 12, objectFit: 'cover', border: '1px solid var(--brand-line)', cursor: can('admit') ? 'pointer' : 'default' }}
                onClick={() => can('admit') && setEditingPhoto(!editingPhoto)}
                title="Click to edit photo"
              />
            ) : (
              <div
                className="avatar"
                style={{ width: 52, height: 52, borderRadius: 12, background: 'var(--brand-soft)', color: 'var(--brand-ink)', fontSize: 18, border: '1px solid var(--brand-line)', cursor: can('admit') ? 'pointer' : 'default' }}
                onClick={() => can('admit') && setEditingPhoto(!editingPhoto)}
                title="Click to edit photo"
              >
                {initials(s.name)}
              </div>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 19 }}>{s.name}</h3>
            <div className="sub">
              {s.admissionNo} · {s.classId?.name}-{s.section} · Admitted {fmtDate(s.admissionDate)} <Chip tone={s.status === 'Active' ? 'paid' : 'up'}>{s.status}</Chip>
            </div>
            {editingPhoto && (
              <div style={{ marginTop: 10 }}>
                <StudentPhotoPicker value={s.photo || ''} onChange={updatePhoto} label="Update Student Photo" />
              </div>
            )}
          </div>
          <button type="button" className="btn btn-sm" onClick={() => nav('/students')}>← Directory</button>
          {can('collect')
            ? <button type="button" className="btn btn-primary btn-sm" onClick={() => nav(`/collect?student=${s._id}`)}>Collect Fee</button>
            : <span className="locked-note">View only</span>}
        </div>
        <div className="panel-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 20 }}>
          <dl className="def">
            <dt>Father</dt><dd>{s.father}</dd>
            <dt>Mother</dt><dd>{s.mother || '—'}</dd>
            <dt>Mobile</dt><dd className="mono">{s.phone}</dd>
            <dt>Email</dt><dd className="tiny">{s.email || '—'}</dd>
          </dl>
          <dl className="def">
            <dt>Date of birth</dt><dd>{fmtDate(s.dob)}</dd>
            <dt>Blood group</dt><dd>{s.bloodGroup || '—'}</dd>
            <dt>Aadhaar</dt><dd className="mono">{s.aadhaarLast4 ? `•••• ${s.aadhaarLast4}` : '—'}</dd>
            <dt>Address</dt><dd>{s.address || '—'}</dd>
          </dl>
          <dl className="def">
            <dt>Gross fee</dt><dd className="mono">{RS(totals.gross)}</dd>
            <dt>Concession</dt><dd className="mono" style={{ color: 'var(--brand)' }}>− {RS(totals.discount)}</dd>
            <dt>Late fee</dt><dd className="mono">{RS(totals.lateFee)}</dd>
            <dt>Net payable</dt><dd className="mono" style={{ fontWeight: 700 }}>{RS(totals.payable)}</dd>
          </dl>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
            <div><div className="lbl">Collected</div><div className="mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--good)' }}>{RS(totals.paid)}</div></div>
            <div><div className="lbl">Outstanding</div><div className="mono" style={{ fontSize: 20, fontWeight: 700, color: totals.outstanding ? 'var(--warn)' : 'var(--text-3)' }}>{RS(totals.outstanding)}</div></div>
            <Bar pct={totals.payable ? (totals.paid / totals.payable) * 100 : 0} />
          </div>
        </div>
      </Panel>

      <div className="split">
        <Panel bodyless title="Fee Ledger" sub={`Instalment wise · ${s.classId?.name} plan`}>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr><th>Inst.</th><th>Due month</th><th className="t-right">Gross</th><th className="t-right">Discount</th>
                  <th className="t-right">Late</th><th className="t-right">Paid</th><th className="t-right">Balance</th><th>Status</th></tr>
              </thead>
              <tbody>
                {ledger.length === 0 && <tr><td colSpan={8}><Empty>No ledger rows.</Empty></td></tr>}
                {ledger.map((l) => {
                  const st = statusOf(l);
                  return (
                    <tr key={l._id}>
                      <td><b className="mono">{l.instNo}</b></td>
                      <td className="tiny nw">{l.month}<div className="tiny muted nw">Due {fmtDate(l.dueDate)}</div></td>
                      <td className="num">{RS(l.gross)}</td>
                      <td className="num">{l.discount ? <span style={{ color: 'var(--brand)' }}>− {RS(l.discount)}</span> : '—'}</td>
                      <td className="num">{l.lateFee ? <span style={{ color: 'var(--crit)' }}>+ {RS(l.lateFee)}</span> : '—'}</td>
                      <td className="num">{l.paid ? RS(l.paid) : '—'}</td>
                      <td className="num" style={{ fontWeight: 700 }}>{l.balance ? RS(l.balance) : '—'}</td>
                      <td><Chip tone={st.k}>{st.t}</Chip></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--surface-2)' }}>
                  <td colSpan={2} style={{ fontWeight: 700 }}>Total</td>
                  <td className="num" style={{ fontWeight: 700 }}>{RS(totals.gross)}</td>
                  <td className="num" style={{ fontWeight: 700, color: 'var(--brand)' }}>{RS(totals.discount)}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{RS(totals.lateFee)}</td>
                  <td className="num" style={{ fontWeight: 700, color: 'var(--good)' }}>{RS(totals.paid)}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{RS(totals.outstanding)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </Panel>

        <Panel bodyless title="Payment history">
          <div className="tbl-wrap">
            <table>
              <tbody>
                {receipts.length === 0 && <tr><td><Empty>No payment recorded yet.</Empty></td></tr>}
                {receipts.map((r) => (
                  <tr key={r._id} className="clickable" onClick={() => setReceiptId(r._id)}>
                    <td>
                      <div className="mono tiny" style={{ color: 'var(--brand)', fontWeight: 600 }}>{r.receiptNo}</div>
                      <div className="tiny muted">{fmtDate(r.date)} · {r.mode}</div>
                      <div className="tiny muted">Inst. {r.lines.map((l) => l.instNo).join(', ')}</div>
                      {r.cancelled?.at && <Chip tone="over">Cancelled</Chip>}
                    </td>
                    <td className="num" style={{ fontWeight: 700 }}>{RS(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {receiptId && <ReceiptView id={receiptId} onClose={() => setReceiptId(null)} onChanged={load} />}
    </div>
  );
}
