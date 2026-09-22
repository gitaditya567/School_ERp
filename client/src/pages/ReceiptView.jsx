import { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Drawer, Loading, Field, Input } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { RS, RS0, fmtDate, formatHeadsShort } from '../lib/format';
import { printReceiptSlip } from '../lib/printSlip';

export default function ReceiptView({ id, onClose, onChanged }) {
  const { can } = useAuth();
  const { toast, error: shout } = useToast();
  const [data, setData] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => { api.get(`/receipts/${id}`).then(setData).catch(shout); }, [id]);

  const doCancel = async () => {
    try {
      const res = await api.post(`/receipts/${id}/cancel`, { reason });
      toast(res.message);
      setCancelling(false);
      onChanged?.();
      onClose();
    } catch (e) { shout(e); }
  };

  const handlePrint = (duplicate = false) => {
    if (!data) return;
    printReceiptSlip({
      receipt: data.receipt,
      school: data.school,
      amountInWords: data.amountInWords,
      duplicate,
    });
  };

  const footer = (
    <>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => handlePrint(false)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
      >
        <span>🖨️</span> Print Slip / PDF
      </button>
      <button
        type="button"
        className="btn btn-sm"
        onClick={() => handlePrint(true)}
        title="Print 2 copies on one sheet: Student Copy + Office Copy"
      >
        2 Copies (Student + Office)
      </button>
      {can('cancelReceipt') && !data?.receipt?.cancelled?.at && (
        <button type="button" className="btn" style={{ color: 'var(--crit)', borderColor: 'var(--crit)' }}
          onClick={() => setCancelling(true)}>Cancel receipt</button>
      )}
      <div style={{ flex: 1 }} />
      <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
    </>
  );

  if (!data) return <Drawer title="Receipt" sub="Fee & Accounts" onClose={onClose}><Loading /></Drawer>;
  const { receipt: r, school, amountInWords } = data;

  return (
    <Drawer title={`${r.type === 'misc' ? 'Misc Receipt' : 'Receipt'} ${r.receiptNo}`} sub={r.type === 'misc' ? `Other Fee · ${r.miscHead || 'General'}` : 'Fee & Accounts'} onClose={onClose} footer={footer}>
      {cancelling && (
        <div className="panel no-print" style={{ marginBottom: 16, borderColor: 'var(--crit)' }}>
          <div className="panel-body">
            <Field label="Why is this receipt being cancelled?">
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Cheque returned unpaid" />
            </Field>
            <p className="tiny muted" style={{ margin: '8px 0 12px' }}>
              The ledger is reversed and the number stays in the register — it is never reused.
            </p>
            <div className="row">
              <button type="button" className="btn btn-primary" style={{ background: 'var(--crit)', borderColor: 'var(--crit)' }} onClick={doCancel}>Confirm cancellation</button>
              <button type="button" className="btn btn-ghost" onClick={() => setCancelling(false)}>Keep it</button>
            </div>
          </div>
        </div>
      )}

      <div className="receipt">
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', borderBottom: '2px solid #B01B5C', paddingBottom: 12 }}>
          {school.logo
            ? <img src={school.logo} alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} />
            : <div style={{ width: 40, height: 40, borderRadius: 10, background: '#B01B5C', color: '#fff', display: 'grid', placeItems: 'center', fontFamily: 'Archivo, sans-serif', fontWeight: 800 }}>
              {(school.name || 'SC').slice(0, 2).toUpperCase()}
            </div>}
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Archivo, sans-serif', fontWeight: 800, fontSize: 17, letterSpacing: '-.02em', textTransform: 'uppercase' }}>{school.name}</div>
            <div style={{ fontSize: 11, color: '#6A6076' }}>{[school.branch, school.phone, school.email].filter(Boolean).join(' · ')}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9.5, letterSpacing: '.12em', color: '#6A6076', fontWeight: 700 }}>
              {r.type === 'misc' ? 'MISCELLANEOUS RECEIPT' : 'FEE RECEIPT'}
            </div>
            <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: '#B01B5C' }}>{r.receiptNo}</div>
            <div style={{ fontSize: 11, color: '#6A6076' }}>{fmtDate(r.date)}</div>
          </div>
        </div>

        {r.cancelled?.at && (
          <div style={{ margin: '12px 0', padding: '8px 10px', border: '1px solid #B3271E', color: '#B3271E', borderRadius: 6, fontSize: 12 }}>
            <b>CANCELLED</b> on {fmtDate(r.cancelled.at)} — {r.cancelled.reason}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', fontSize: 12.5, margin: '14px 0' }}>
          <div><span style={{ color: '#6A6076' }}>Student:</span> <b>{r.student?.name}</b></div>
          <div><span style={{ color: '#6A6076' }}>Adm. No:</span> <b className="mono">{r.student?.admissionNo}</b></div>
          <div><span style={{ color: '#6A6076' }}>Class:</span> <b>{r.classId?.name}-{r.student?.section}</b></div>
          <div><span style={{ color: '#6A6076' }}>Father:</span> <b>{r.student?.father}</b></div>
          <div><span style={{ color: '#6A6076' }}>Session:</span> <b>{school.session || '—'}</b></div>
          <div><span style={{ color: '#6A6076' }}>Mode:</span> <b>{r.mode}</b> <span className="mono" style={{ fontSize: 11, color: '#6A6076' }}>{r.refNo}</span></div>
          {r.type === 'misc' && (
            <div style={{ gridColumn: '1 / -1', background: '#F6F2F7', padding: '6px 10px', borderRadius: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ color: '#6A6076' }}>Fee Purpose / Head:</span>
              <b style={{ color: '#B01B5C' }}>{r.miscHead || 'Other Fee'}</b>
              {r.remarks && <span style={{ color: '#6A6076', fontSize: 11.5 }}>({r.remarks})</span>}
            </div>
          )}
        </div>

        {r.type === 'misc' ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: '#F6F2F7' }}>
                <th style={{ background: 'none', color: '#6A6076', borderBottom: '1px solid #D9D2E0', padding: '7px 8px', textAlign: 'left' }}>Particulars / Purpose</th>
                <th style={{ background: 'none', color: '#6A6076', borderBottom: '1px solid #D9D2E0', padding: '7px 8px', textAlign: 'left' }}>Remarks / Note</th>
                <th style={{ background: 'none', color: '#6A6076', borderBottom: '1px solid #D9D2E0', padding: '7px 8px', textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {(r.lines || [{ head: r.miscHead, net: r.total, reason: r.remarks }]).map((l, idx) => (
                <tr key={idx}>
                  <td style={{ padding: '8px', borderBottom: '1px solid #EEE9F2' }}>
                    <b style={{ color: '#2C1930' }}>{l.head || r.miscHead || 'Miscellaneous Fee'}</b>
                  </td>
                  <td style={{ padding: '8px', borderBottom: '1px solid #EEE9F2', color: '#555' }}>
                    {l.reason || r.remarks || '—'}
                  </td>
                  <td className="mono" style={{ padding: '8px', borderBottom: '1px solid #EEE9F2', textAlign: 'right', fontWeight: 700 }}>
                    {RS0(l.net || r.total)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2} style={{ padding: '9px 8px', textAlign: 'right', fontWeight: 700 }}>Total received</td>
                <td style={{ padding: '9px 8px', textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, fontSize: 15, color: '#B01B5C' }}>{RS(r.total)}</td>
              </tr>
            </tfoot>
          </table>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: '#F6F2F7' }}>
                {['Inst.', 'Due month', 'Fee', 'Discount', 'Late fee', 'Amount'].map((h, i) => (
                  <th key={h} style={{ background: 'none', color: '#6A6076', borderBottom: '1px solid #D9D2E0', padding: '7px 8px', textAlign: i > 1 ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.lines.map((l) => {
                const headsShort = formatHeadsShort(l.head);
                return (
                  <tr key={l.instNo}>
                    <td style={{ padding: '7px 8px', borderBottom: '1px solid #EEE9F2' }}><b>{l.instNo}</b></td>
                    <td style={{ padding: '7px 8px', borderBottom: '1px solid #EEE9F2' }}>
                      <span>{l.month}</span>
                      {headsShort && (
                        <span style={{ color: '#6A6076', fontSize: 11, marginLeft: 5, fontWeight: 500 }}>
                          ({headsShort})
                        </span>
                      )}
                      {l.reason && <div style={{ fontSize: 10.5, color: '#B01B5C' }}>{l.reason}</div>}
                      {l.balanceRemaining > 0 && <div style={{ fontSize: 10.5, color: '#B3271E', fontWeight: 600 }}>Bal. due: {RS(l.balanceRemaining)} (Partial)</div>}
                    </td>
                    <td className="mono" style={{ padding: '7px 8px', borderBottom: '1px solid #EEE9F2', textAlign: 'right' }}>{RS0(l.gross)}</td>
                    <td className="mono" style={{ padding: '7px 8px', borderBottom: '1px solid #EEE9F2', textAlign: 'right', color: '#B01B5C' }}>{l.discount ? `−${RS0(l.discount)}` : '—'}</td>
                    <td className="mono" style={{ padding: '7px 8px', borderBottom: '1px solid #EEE9F2', textAlign: 'right' }}>{l.lateFee ? RS0(l.lateFee) : '—'}</td>
                    <td className="mono" style={{ padding: '7px 8px', borderBottom: '1px solid #EEE9F2', textAlign: 'right', fontWeight: 700 }}>{RS0(l.net)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} style={{ padding: '9px 8px', textAlign: 'right', fontWeight: 700 }}>Total received</td>
                <td style={{ padding: '9px 8px', textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, fontSize: 15, color: '#B01B5C' }}>{RS(r.total)}</td>
              </tr>
            </tfoot>
          </table>
        )}

        <div className="r-line" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: 11, color: '#6A6076' }}>
          <div style={{ maxWidth: '60%' }}>
            <div><b>Rupees:</b> {amountInWords} only</div>
            {school.payeeName && <div style={{ marginTop: 6 }}>Cheque/DD in favour of “{school.payeeName}”. {school.refundNote}</div>}
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ height: 26 }} />
            <div style={{ borderTop: '1px solid #9A90A6', paddingTop: 4, minWidth: 130 }}>{r.collectedBy?.name} · Authorised</div>
          </div>
        </div>

        <div className="receipt-copy">
          <span>Computer-generated receipt</span>
          <span>
            Developed by{' '}
            <a href="https://twinscloud.com" target="_blank" rel="noopener noreferrer">
              <b>Twinscloud Pvt. Ltd.</b>
            </a>
          </span>
        </div>
      </div>
    </Drawer>
  );
}
