import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Panel, Chip, Loading, Empty, Input, Select, Field } from '../components/ui';
import ReceiptView from './ReceiptView';
import { RS, fmtDate, initials, statusOf } from '../lib/format';

const MODES = ['UPI', 'Bank Transfer (NEFT/IMPS)', 'Cheque', 'Demand Draft', 'Cash (at office)', 'Card'];
const REASONS = ['Sibling Concession', 'Staff Ward', 'Full Session Advance', 'Merit Scholarship',
  'Financial Hardship', 'Management Approval', 'Fee Card Correction'];
const MISC_CATEGORIES = [
  { id: 'Uniform', label: 'Uniform / Dress', icon: '👕' },
  { id: 'Books & Stationery', label: 'Books & Stationery', icon: '📚' },
  { id: 'Annual Function', label: 'Annual Function / Sports Day', icon: '🎭' },
  { id: 'Tour / Picnic', label: 'Tour / Picnic / Excursion', icon: '🚌' },
  { id: 'Exam Fee', label: 'Exam / Assessment Fee', icon: '📝' },
  { id: 'ID Card', label: 'ID Card / Badge', icon: '🪪' },
  { id: 'TC / Certificate', label: 'TC / Certificate', icon: '📜' },
  { id: 'Activity / Workshop', label: 'Activity / Workshop', icon: '🎒' },
  { id: 'Late / Discipline Fine', label: 'Discipline / Late Fine', icon: '⚠️' },
  { id: 'Other', label: 'Other Miscellaneous', icon: '✏️' },
];
const PRESET_AMOUNTS = [200, 500, 1000, 1500, 2000, 2500, 5000];
const today = new Date().toISOString().slice(0, 10);

export default function CollectFee() {
  const [params, setParams] = useSearchParams();
  const studentId = params.get('student');
  const urlMode = params.get('mode') === 'misc' ? 'misc' : 'regular';
  const [mode, setMode] = useState(urlMode);
  const nav = useNavigate();
  const { maxDiscount } = useAuth();
  const { toast, error: shout } = useToast();

  const [list, setList] = useState(null);
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [sel, setSel] = useState({});
  const [pay, setPay] = useState({ date: today, mode: MODES[0], refNo: '', remarks: '' });
  const [busy, setBusy] = useState(false);
  const [receiptId, setReceiptId] = useState(null);
  const [isPartial, setIsPartial] = useState(false);
  const [partialAmount, setPartialAmount] = useState('');

  // Misc fee state
  const [misc, setMisc] = useState({
    category: 'Uniform',
    head: 'Uniform / Dress',
    amount: '',
    mode: MODES[0],
    refNo: '',
    remarks: '',
    date: today,
  });
  const [miscBusy, setMiscBusy] = useState(false);

  useEffect(() => { document.title = 'Collect Fee'; }, []);

  useEffect(() => {
    if (params.get('mode') === 'misc') {
      setMode('misc');
    } else if (params.get('mode') === 'regular') {
      setMode('regular');
    }
  }, [params]);

  const switchMode = (newMode) => {
    setMode(newMode);
    const nextParams = {};
    if (studentId) nextParams.student = studentId;
    if (newMode === 'misc') nextParams.mode = 'misc';
    setParams(nextParams);
  };

  useEffect(() => {
    if (studentId) return;
    const delay = search ? 220 : 0;
    const id = setTimeout(() => api.get('/students', { params: { search } }).then((d) => setList(d.students)).catch(shout), delay);
    return () => clearTimeout(id);
  }, [search, studentId]);

  const loadStudent = () => {
    setData(null); setSel({}); setIsPartial(false); setPartialAmount('');
    api.get(`/fee/pending/${studentId}`, { params: { date: pay.date } }).then(setData).catch(shout);
  };
  useEffect(() => { if (studentId) loadStudent(); }, [studentId, pay.date]);

  /* -------------------- student picker (no student selected) -------------------- */
  if (!studentId) {
    return (
      <div className="stack">
        <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
          <button
            type="button"
            className={`btn ${mode === 'regular' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => switchMode('regular')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', fontWeight: 600, fontSize: 13.5 }}
          >
            <span>📋</span> Regular Instalment Fee
          </button>
          <button
            type="button"
            className={`btn ${mode === 'misc' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => switchMode('misc')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', fontWeight: 600, fontSize: 13.5 }}
          >
            <span>🏷️</span> Miscellaneous / Other Fee
          </button>
        </div>

        <Panel
          bodyless
          title={mode === 'misc' ? 'Collect Miscellaneous / Other Fee' : 'Collect Fee'}
          sub={mode === 'misc' ? 'Search & pick a student to collect miscellaneous fees (Uniform, Books, Exam, Activity, Fine, etc.)' : 'Pick a student, select instalments, apply any concession and generate the receipt'}
          actions={<Input style={{ width: 230 }} autoFocus placeholder="Name / Adm. No / Mobile" value={search} onChange={(e) => setSearch(e.target.value)} />}
        >
          {!list ? <Loading /> : (
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>Adm. No</th><th>Student</th><th>Class</th><th>Father</th><th className="t-right">Outstanding</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {list.length === 0 && <tr><td colSpan={7}><Empty>No matching student.</Empty></td></tr>}
                  {list.map((s) => (
                    <tr key={s._id} className="clickable" onClick={() => {
                      const nextP = { student: s._id };
                      if (mode === 'misc') nextP.mode = 'misc';
                      setParams(nextP);
                    }}>
                      <td className="mono tiny">{s.admissionNo}</td>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td><span className="tag">{s.classId?.name}</span></td>
                      <td>{s.father}</td>
                      <td className="num" style={{ fontWeight: 700, color: s.totals?.outstanding ? 'var(--warn)' : 'var(--text-3)' }}>{RS(s.totals?.outstanding || 0)}</td>
                      <td>{s.totals?.overdue > 0 ? <Chip tone="over">Overdue</Chip> : s.totals?.outstanding > 0 ? <Chip tone="due">Due</Chip> : <Chip tone="paid">Clear</Chip>}</td>
                      <td className="t-right">
                        <button type="button" className="btn btn-sm btn-primary">
                          {mode === 'misc' ? 'Select for Misc Fee →' : 'Select →'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    );
  }

  if (!data) return <Loading />;
  const { student, rows, school, receipts = [] } = data;
  const pending = rows.filter((r) => r.balance > 0);
  const outstanding = pending.reduce((s, r) => s + r.balance, 0);

  /* -------------------- Regular fee logic -------------------- */
  const canSelect = (idx) => {
    if (effectiveIsPartial && Object.keys(sel).length > 0 && !sel[pending[idx]._id]) return false;
    for (let i = 0; i < idx; i++) {
      if (!sel[pending[i]._id]) return false;
    }
    return true;
  };

  const toggle = (row) => {
    const idx = pending.findIndex((r) => r._id === row._id);
    if (idx === -1) return;

    setSel((p) => {
      const n = { ...p };
      if (n[row._id]) {
        for (let i = idx; i < pending.length; i++) {
          delete n[pending[i]._id];
        }
      } else {
        if (!canSelect(idx)) {
          toast('Pay previous pending instalments in full first.');
          return p;
        }
        n[row._id] = { discount: 0, discountReason: '', lateFee: row.suggestedLateFee };
      }
      return n;
    });
  };

  const patch = (id, k, v) => setSel((p) => ({ ...p, [id]: { ...p[id], [k]: v } }));

  const totals = Object.entries(sel).reduce((t, [id, v]) => {
    const row = rows.find((r) => r._id === id);
    if (!row) return t;
    t.gross += row.balance; t.discount += Number(v.discount) || 0; t.lateFee += Number(v.lateFee) || 0;
    return t;
  }, { gross: 0, discount: 0, lateFee: 0 });

  const selectedList = Object.keys(sel).map((id) => rows.find((x) => x._id === id)).filter(Boolean);
  const hasAlreadyPaidPartial = selectedList.some((r) => (r.paid || 0) > 0);
  const isPartialDisabled = hasAlreadyPaidPartial || selectedList.length > 1;
  const effectiveIsPartial = isPartial && !isPartialDisabled;

  const grandTotal = Math.max(0, totals.gross - totals.discount + totals.lateFee);
  const payableNow = effectiveIsPartial ? Math.max(0, Math.min(grandTotal, Number(partialAmount) || 0)) : grandTotal;

  const submit = async () => {
    if (effectiveIsPartial) {
      const amt = Number(partialAmount) || 0;
      if (amt <= 0) {
        toast('Enter a valid partial payment amount greater than zero.');
        return;
      }
      if (amt >= grandTotal) {
        toast('Partial amount must be less than total receivable. Switch to Full Payment instead.');
        return;
      }
    }
    setBusy(true);
    try {
      const selectedEntries = Object.entries(sel);
      const lines = selectedEntries.map(([ledgerId, v], idx) => {
        const line = { ledgerId, ...v };
        if (effectiveIsPartial && idx === 0) {
          line.payingAmount = Number(partialAmount);
        }
        return line;
      });

      const res = await api.post('/fee/collect', {
        studentId, date: pay.date, mode: pay.mode, refNo: pay.refNo, remarks: pay.remarks,
        lines,
      });
      toast(`Receipt ${res.receipt.receiptNo} generated · ${RS(res.receipt.total)}`);
      setReceiptId(res.receipt._id);
      setIsPartial(false);
      setPartialAmount('');
      loadStudent();
    } catch (e) { shout(e); } finally { setBusy(false); }
  };

  /* -------------------- Misc fee submit -------------------- */
  const submitMisc = async () => {
    const finalHead = (misc.head || misc.category || '').trim();
    if (!finalHead) {
      toast('Please enter the fee purpose / head (kis baat ki fee hai).');
      return;
    }
    const amt = Number(misc.amount);
    if (!amt || amt <= 0) {
      toast('Please enter a valid amount greater than zero.');
      return;
    }
    setMiscBusy(true);
    try {
      const res = await api.post('/fee/collect-misc', {
        studentId,
        amount: amt,
        head: finalHead,
        date: misc.date,
        mode: misc.mode,
        refNo: misc.refNo,
        remarks: misc.remarks,
      });
      toast(`Miscellaneous Receipt ${res.receipt.receiptNo} generated · ${RS(res.receipt.total)}`);
      setReceiptId(res.receipt._id);
      setMisc((prev) => ({ ...prev, amount: '', remarks: '', refNo: '' }));
      loadStudent();
    } catch (e) {
      shout(e);
    } finally {
      setMiscBusy(false);
    }
  };

  return (
    <div className="stack">
      {/* Top Mode Segmented Switcher */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button
          type="button"
          className={`btn ${mode === 'regular' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => switchMode('regular')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', fontWeight: 600, fontSize: 13.5 }}
        >
          <span>📋</span> Regular Instalment Fee
        </button>
        <button
          type="button"
          className={`btn ${mode === 'misc' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => switchMode('misc')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', fontWeight: 600, fontSize: 13.5 }}
        >
          <span>🏷️</span> Miscellaneous / Other Fee
        </button>
      </div>

      {mode === 'misc' ? (
        /* ==================== MISCELLANEOUS FEE VIEW ==================== */
        <div className="split">
          <div className="stack" style={{ flex: 1.3 }}>
            <Panel bodyless>
              <div className="panel-head">
                <div className="avatar" style={{ background: 'var(--brand-soft)', color: 'var(--brand-ink)', border: '1px solid var(--brand-line)' }}>
                  {initials(student.name)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0 }}>{student.name}</h3>
                    <Chip tone="part">Misc Fee Mode</Chip>
                  </div>
                  <div className="sub">
                    {student.admissionNo} · {student.classId?.name}-{student.section} · {student.father} · <span className="mono">{student.phone}</span>
                    {student.alternatePhone ? <span className="mono muted"> / {student.alternatePhone}</span> : null}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="lbl">Tuition Outstanding</div>
                  <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: outstanding ? 'var(--warn)' : 'var(--text-3)' }}>
                    {RS(outstanding)}
                  </div>
                </div>
                <button type="button" className="btn btn-sm" onClick={() => setParams({ mode: 'misc' })}>
                  Change
                </button>
              </div>

              <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Auto Receipt Number Display */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(176, 27, 92, 0.05) 0%, rgba(176, 27, 92, 0.12) 100%)',
                  border: '1px solid var(--brand-line)',
                  borderRadius: 8,
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Auto-Assigned Receipt Number
                    </div>
                    <div className="mono" style={{ fontSize: 20, fontWeight: 800, color: 'var(--brand)', marginTop: 2 }}>
                      {data.nextReceiptNo || 'PJ/26-27/....'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Chip tone="paid">Unified Register Sequence</Chip>
                    <div className="tiny muted" style={{ marginTop: 4 }}>Auto-assigned sequentially</div>
                  </div>
                </div>

                {/* Category Preset Selector */}
                <div>
                  <div className="lbl" style={{ marginBottom: 8, fontWeight: 700, color: 'var(--text-1)' }}>
                    Select Fee Category / Head (Kis baat ki fee hai) *
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8 }}>
                    {MISC_CATEGORIES.map((cat) => {
                      const isSel = misc.category === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setMisc({
                            ...misc,
                            category: cat.id,
                            head: cat.id === 'Other' ? '' : cat.label,
                          })}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '8px 12px',
                            borderRadius: 7,
                            border: isSel ? '2px solid var(--brand)' : '1px solid var(--line)',
                            background: isSel ? 'var(--brand-soft)' : 'var(--surface-2)',
                            color: isSel ? 'var(--brand-ink)' : 'var(--text-1)',
                            cursor: 'pointer',
                            fontWeight: isSel ? 700 : 500,
                            fontSize: 12.5,
                            textAlign: 'left',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span style={{ fontSize: 16 }}>{cat.icon}</span>
                          <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {cat.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Particulars / Purpose Text */}
                <Field label="Fee Purpose / Particulars *" sub="Enter or modify exact purpose (e.g. Winter Uniform, Sports Kit, Olympiad Registration)">
                  <Input
                    value={misc.head}
                    onChange={(e) => setMisc({ ...misc, head: e.target.value })}
                    placeholder="e.g. Uniform (2 sets) / Activity fee / Annual function"
                  />
                </Field>

                {/* Amount with Quick Presets */}
                <div>
                  <Field label="Fee Amount (₹) *">
                    <Input
                      type="number"
                      min="1"
                      className="num"
                      style={{ fontSize: 18, fontWeight: 700, padding: '8px 12px' }}
                      value={misc.amount}
                      onChange={(e) => setMisc({ ...misc, amount: e.target.value })}
                      placeholder="Enter amount in ₹"
                    />
                  </Field>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
                    <span className="tiny muted" style={{ fontWeight: 600 }}>Quick Presets:</span>
                    {PRESET_AMOUNTS.map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        className="btn btn-sm"
                        style={{
                          padding: '3px 8px',
                          fontSize: 11.5,
                          fontWeight: 600,
                          background: Number(misc.amount) === amt ? 'var(--brand)' : undefined,
                          color: Number(misc.amount) === amt ? '#fff' : undefined,
                        }}
                        onClick={() => setMisc({ ...misc, amount: String(amt) })}
                      >
                        +{RS(amt)}
                      </button>
                    ))}
                    {misc.amount ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        style={{ padding: '3px 8px', fontSize: 11.5 }}
                        onClick={() => setMisc({ ...misc, amount: '' })}
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Payment Details */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  <Field label="Payment Mode">
                    <Select value={misc.mode} onChange={(e) => setMisc({ ...misc, mode: e.target.value })}>
                      {MODES.map((m) => <option key={m}>{m}</option>)}
                    </Select>
                  </Field>
                  <Field label="Payment Date">
                    <Input type="date" max={today} value={misc.date} onChange={(e) => setMisc({ ...misc, date: e.target.value })} />
                  </Field>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  <Field label="UTR / Cheque / Ref No">
                    <Input value={misc.refNo} onChange={(e) => setMisc({ ...misc, refNo: e.target.value })} placeholder="optional (UPI Ref / Cheque No)" />
                  </Field>
                  <Field label="Remarks / Notes">
                    <Input value={misc.remarks} onChange={(e) => setMisc({ ...misc, remarks: e.target.value })} placeholder="optional note" />
                  </Field>
                </div>

                {/* Bottom Collect Action */}
                <div style={{
                  background: 'var(--surface-2)',
                  padding: '14px 16px',
                  borderRadius: 8,
                  border: '1px solid var(--line)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 4,
                }}>
                  <div>
                    <div className="tiny muted">Amount to receive:</div>
                    <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: 'var(--brand)' }}>
                      {RS(Number(misc.amount) || 0)}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: '10px 22px', fontSize: 14, fontWeight: 700, gap: 6 }}
                    disabled={miscBusy || !misc.amount || Number(misc.amount) <= 0 || !misc.head.trim()}
                    onClick={submitMisc}
                  >
                    {miscBusy ? 'Generating Receipt…' : `🖨️ Collect & Print Receipt (${RS(Number(misc.amount) || 0)})`}
                  </button>
                </div>
              </div>
            </Panel>

            {/* Previous Transactions in Misc Mode */}
            <Panel
              bodyless
              title="Previous Fee Transactions / History"
              sub={receipts?.length ? `${receipts.length} transaction${receipts.length === 1 ? '' : 's'} recorded` : 'No past transactions for this student'}
            >
              <div className="tbl-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Receipt No</th>
                      <th>Date</th>
                      <th>Type / Particulars</th>
                      <th>Mode / Ref</th>
                      <th className="t-right">Amount Paid</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {(!receipts || receipts.length === 0) && (
                      <tr><td colSpan={7}><Empty>No previous fee receipts found for this student.</Empty></td></tr>
                    )}
                    {receipts?.map((r) => (
                      <tr key={r._id} className="clickable" onClick={() => setReceiptId(r._id)}>
                        <td>
                          <b className="mono tiny" style={{ color: 'var(--brand)' }}>{r.receiptNo}</b>
                          {r.type === 'misc' && <div><Chip tone="part">Other: {r.miscHead || 'Misc'}</Chip></div>}
                        </td>
                        <td className="tiny nw">{fmtDate(r.date)}</td>
                        <td className="tiny">
                          {r.type === 'misc' ? (
                            <span style={{ fontWeight: 600, color: 'var(--brand)' }}>{r.miscHead || 'Miscellaneous Fee'}</span>
                          ) : (
                            r.lines?.map((l, i) => (
                              <span key={i} style={{ marginRight: 6 }}>
                                <b>{l.instNo}</b> ({l.month}){l.balanceRemaining > 0 ? <span style={{ color: 'var(--warn)', marginLeft: 3, fontWeight: 600 }}>[Partial]</span> : ''}
                              </span>
                            ))
                          )}
                        </td>
                        <td className="tiny">
                          <span>{r.mode}</span>
                          {r.refNo && <span className="mono muted" style={{ marginLeft: 6 }}>{r.refNo}</span>}
                        </td>
                        <td className="num" style={{ fontWeight: 700, color: 'var(--good)' }}>{RS(r.total)}</td>
                        <td>
                          {r.cancelled?.at ? <Chip tone="over">Cancelled</Chip> : r.type === 'misc' ? <Chip tone="part">Other Fee</Chip> : <Chip tone="paid">Paid</Chip>}
                        </td>
                        <td className="t-right">
                          <button type="button" className="btn btn-sm" onClick={(e) => { e.stopPropagation(); setReceiptId(r._id); }}>
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>

          {/* Right sidebar info */}
          <div className="stack" style={{ flex: 0.7 }}>
            <Panel title="Collection Summary" sub="Miscellaneous fee details">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="muted">Fee Category:</span>
                  <b>{misc.category}</b>
                </div>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="muted">Particulars:</span>
                  <b style={{ color: 'var(--brand)' }}>{misc.head || '—'}</b>
                </div>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="muted">Payment Mode:</span>
                  <b>{misc.mode}</b>
                </div>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="muted">Payment Date:</span>
                  <b>{fmtDate(misc.date)}</b>
                </div>
                <hr className="hr" style={{ margin: '4px 0' }} />
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <b>Total Amount:</b>
                  <b className="mono" style={{ fontSize: 20, color: 'var(--brand)' }}>{RS(Number(misc.amount) || 0)}</b>
                </div>
                <div className="tiny muted" style={{ lineHeight: 1.4, marginTop: 4 }}>
                  Miscellaneous receipts are recorded in the general receipt sequence and will be available for instant printing upon creation.
                </div>
              </div>
            </Panel>

            <Panel title="Regular Tuition Status" sub="Current academic session">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="muted">Tuition Outstanding:</span>
                  <b className="mono" style={{ fontSize: 16, color: outstanding ? 'var(--warn)' : 'var(--good)' }}>{RS(outstanding)}</b>
                </div>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => switchMode('regular')}
                  style={{ justifyContent: 'center', marginTop: 4 }}
                >
                  📋 Switch to Collect Regular Fee
                </button>
              </div>
            </Panel>
          </div>
        </div>
      ) : (
        /* ==================== REGULAR INSTALMENT FEE VIEW ==================== */
        <div className="split">
          <div className="stack">
            <Panel bodyless>
              <div className="panel-head">
                <div className="avatar" style={{ background: 'var(--brand-soft)', color: 'var(--brand-ink)', border: '1px solid var(--brand-line)' }}>{initials(student.name)}</div>
                <div style={{ flex: 1 }}>
                  <h3>{student.name}</h3>
                  <div className="sub">{student.admissionNo} · {student.classId?.name}-{student.section} · {student.father} · <span className="mono">{student.phone}</span>{student.alternatePhone ? <span className="mono muted"> / {student.alternatePhone}</span> : null}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="lbl">Outstanding</div>
                  <div className="mono" style={{ fontSize: 17, fontWeight: 700, color: 'var(--warn)' }}>{RS(outstanding)}</div>
                </div>
                <button type="button" className="btn btn-sm" onClick={() => setParams({})}>Change</button>
              </div>
              <div className="tbl-wrap">
                <table>
                  <thead>
                    <tr><th style={{ width: 34 }} /><th>Inst.</th><th>Due month</th><th className="t-right">Balance</th>
                      <th className="t-right">Discount</th><th style={{ width: 170 }}>Discount reason</th>
                      <th className="t-right">Late fee</th><th className="t-right">Payable</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {pending.length === 0 && <tr><td colSpan={9}><Empty>All fees are cleared.</Empty></td></tr>}
                    {pending.map((r, idx) => {
                      const on = Boolean(sel[r._id]);
                      const v = sel[r._id] || {};
                      const st = statusOf(r);
                      const cap = Math.min(r.balance, maxDiscount);
                      const disabled = !on && !canSelect(idx);
                      return (
                        <tr key={r._id} style={on ? { background: 'var(--brand-soft)' } : undefined}>
                          <td>
                            <input
                              type="checkbox"
                              checked={on}
                              disabled={disabled}
                              title={disabled ? 'Pay previous pending instalment in full first' : undefined}
                              onChange={() => toggle(r)}
                              aria-label={`Select instalment ${r.instNo}`}
                            />
                          </td>
                          <td>
                            <b className="mono">{r.instNo}</b>
                            {r.isCarryForward && <div className="tiny" style={{ color: 'var(--warn)' }}>C/F</div>}
                            {r.paid > 0 && <div className="tiny" style={{ color: 'var(--warn)', fontWeight: 600 }}>Partial ({RS(r.paid)} paid)</div>}
                            {disabled && <div className="tiny muted" title="Sequential requirement">Locked</div>}
                          </td>
                          <td className="tiny nw">
                            {r.month}
                            <div className="tiny muted nw">
                              Due {fmtDate(r.dueDate)}
                              {r.daysLate > 0 && <span style={{ color: 'var(--warn)', fontWeight: 600, marginLeft: 4 }}>({r.daysLate}d late)</span>}
                            </div>
                          </td>
                          <td className="num">{RS(r.balance)}</td>
                          <td className="t-right">
                            <input className="input num" style={{ width: 92, padding: '4px 8px' }} inputMode="numeric"
                              disabled={!on || maxDiscount === 0} value={v.discount ?? 0}
                              title={maxDiscount === 0 ? 'Your role cannot apply a concession' : `Maximum ${RS(cap)}`}
                              onChange={(e) => {
                                const raw = Number(e.target.value.replace(/\D/g, '')) || 0;
                                if (raw > cap) toast(maxDiscount === 0 ? 'Your role cannot apply a concession' : `Your limit is ${RS(maxDiscount)} — ask the Principal to approve more`);
                                patch(r._id, 'discount', Math.min(raw, cap));
                              }} />
                          </td>
                          <td>
                            <select className="input" style={{ padding: '4px 8px', fontSize: 12 }}
                              disabled={!on || !(v.discount > 0)} value={v.discountReason || ''}
                              onChange={(e) => patch(r._id, 'discountReason', e.target.value)}>
                              <option value="">— select —</option>
                              {REASONS.map((x) => <option key={x}>{x}</option>)}
                            </select>
                          </td>
                          <td className="t-right">
                            <input className="input num" style={{ width: 74, padding: '4px 8px' }} inputMode="numeric" disabled={!on}
                              value={v.lateFee ?? r.suggestedLateFee}
                              onChange={(e) => patch(r._id, 'lateFee', Number(e.target.value.replace(/\D/g, '')) || 0)} />
                          </td>
                          <td className="num" style={{ fontWeight: 700 }}>
                            {on ? RS(Math.max(0, r.balance - (Number(v.discount) || 0) + (Number(v.lateFee) || 0))) : '—'}
                          </td>
                          <td><Chip tone={st.k}>{st.t}</Chip></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="panel-body" style={{ borderTop: '1px solid var(--line)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button type="button" className="btn btn-sm" onClick={() => {
                  setIsPartial(false);
                  setSel(Object.fromEntries(pending.map((r) => [r._id, { discount: 0, discountReason: '', lateFee: r.suggestedLateFee }])));
                }}>Select all</button>
                <button type="button" className="btn btn-sm" onClick={() => {
                  setIsPartial(false);
                  const newSel = {};
                  for (const r of pending) {
                    if (['over', 'due'].includes(statusOf(r).k)) {
                      newSel[r._id] = { discount: 0, discountReason: '', lateFee: r.suggestedLateFee };
                    } else {
                      break;
                    }
                  }
                  setSel(newSel);
                }}>Due + overdue only</button>
                <button type="button" className="btn btn-sm" onClick={() => { setSel({}); setIsPartial(false); setPartialAmount(''); }}>Clear</button>
                <div style={{ flex: 1 }} />
                <span className="locked-note">
                  {maxDiscount === Infinity ? 'You can approve any concession'
                    : maxDiscount > 0 ? `Concession limit ${RS(maxDiscount)} — above that needs the Principal`
                      : 'Concession locked for your role'}
                </span>
              </div>
            </Panel>

            {/* Previous Transactions Panel in Regular Mode */}
            <Panel bodyless title="Previous Fee Transactions / History"
              sub={receipts?.length ? `${receipts.length} transaction${receipts.length === 1 ? '' : 's'} recorded` : 'No past transactions for this student'}>
              <div className="tbl-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Receipt No</th>
                      <th>Date</th>
                      <th>Type / Instalments</th>
                      <th>Mode / Ref</th>
                      <th className="t-right">Amount Paid</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {(!receipts || receipts.length === 0) && (
                      <tr><td colSpan={7}><Empty>No previous fee receipts found for this student.</Empty></td></tr>
                    )}
                    {receipts?.map((r) => (
                      <tr key={r._id} className="clickable" onClick={() => setReceiptId(r._id)}>
                        <td>
                          <b className="mono tiny" style={{ color: 'var(--brand)' }}>{r.receiptNo}</b>
                          {r.type === 'misc' && <div><Chip tone="part">Other: {r.miscHead || 'Misc'}</Chip></div>}
                        </td>
                        <td className="tiny nw">{fmtDate(r.date)}</td>
                        <td className="tiny">
                          {r.type === 'misc' ? (
                            <span style={{ fontWeight: 600, color: 'var(--brand)' }}>{r.miscHead || 'Miscellaneous Fee'}</span>
                          ) : (
                            r.lines?.map((l, i) => (
                              <span key={i} style={{ marginRight: 6 }}>
                                <b>{l.instNo}</b> ({l.month}){l.balanceRemaining > 0 ? <span style={{ color: 'var(--warn)', marginLeft: 3, fontWeight: 600 }}>[Partial]</span> : ''}
                              </span>
                            ))
                          )}
                        </td>
                        <td className="tiny">
                          <span>{r.mode}</span>
                          {r.refNo && <span className="mono muted" style={{ marginLeft: 6 }}>{r.refNo}</span>}
                        </td>
                        <td className="num" style={{ fontWeight: 700, color: 'var(--good)' }}>{RS(r.total)}</td>
                        <td>
                          {r.cancelled?.at ? <Chip tone="over">Cancelled</Chip> : r.type === 'misc' ? <Chip tone="part">Other Fee</Chip> : <Chip tone="paid">Paid</Chip>}
                        </td>
                        <td className="t-right">
                          <button type="button" className="btn btn-sm" onClick={(e) => { e.stopPropagation(); setReceiptId(r._id); }}>
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>

          <Panel
            title="Payment summary"
            sub={
              (!school.lateFeeStructure || school.lateFeeStructure === 'tiered')
                ? `Late fee: ₹${school.lateFeeTier1Amount ?? 200} (≤${school.lateFeeTier1Days ?? 10}d) · ₹${school.lateFeeTier2Amount ?? 300} (≤${school.lateFeeTier2Days ?? 20}d) · ₹${school.lateFeeTier3Amount ?? 500} (>${school.lateFeeTier2Days ?? 20}d)`
                : school.lateFeeAmount ? `Late fee ${RS(school.lateFeeAmount)} after the ${school.lateFeeFrom}th` : undefined
            }
            className="" >
            {Object.keys(sel).length === 0 ? (
              <Empty>Select instalments on the left.<br /><span className="tiny">Discount and late fee can be set per row.</span></Empty>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {Object.keys(sel).map((id) => {
                  const r = rows.find((x) => x._id === id);
                  return (
                    <div key={id} className="row" style={{ justifyContent: 'space-between', fontSize: 12.5 }}>
                      <span>Inst. <b className="mono">{r.instNo}</b> <span className="muted tiny">{r.month}</span></span>
                      <span className="mono">{RS(r.balance)}</span>
                    </div>
                  );
                })}
                <hr className="hr" style={{ margin: '2px 0' }} />
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Gross</span><span className="mono">{RS(totals.gross)}</span></div>
                <div className="row" style={{ justifyContent: 'space-between' }}><span style={{ color: 'var(--brand)' }}>Discount</span><span className="mono" style={{ color: 'var(--brand)' }}>− {RS(totals.discount)}</span></div>
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Late fee</span><span className="mono">+ {RS(totals.lateFee)}</span></div>
                <div className="row" style={{ justifyContent: 'space-between', borderTop: '1px solid var(--line)', paddingTop: 9 }}>
                  <b>Total receivable</b><b className="mono" style={{ fontSize: 19, color: 'var(--brand)' }}>{RS(grandTotal)}</b>
                </div>

                {/* Payment Option Selection: Full vs Partial */}
                <div style={{ background: 'var(--surface-2)', padding: '12px', borderRadius: 8, border: '1px solid var(--line)', marginTop: 4 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 8, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Payment Option
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginBottom: effectiveIsPartial ? 10 : 0 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                      <input
                        type="radio"
                        name="payOption"
                        checked={!effectiveIsPartial}
                        onChange={() => setIsPartial(false)}
                      />
                      <span>Full Payment</span>
                    </label>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        cursor: isPartialDisabled ? 'not-allowed' : 'pointer',
                        fontSize: 13,
                        opacity: isPartialDisabled ? 0.45 : 1,
                      }}
                      title={
                        hasAlreadyPaidPartial
                          ? 'This instalment is already partially paid. The remaining balance must be paid in full.'
                          : selectedList.length > 1
                            ? 'Partial payment is only available when selecting a single instalment.'
                            : undefined
                      }
                    >
                      <input
                        type="radio"
                        name="payOption"
                        disabled={isPartialDisabled}
                        checked={effectiveIsPartial}
                        onChange={() => {
                          if (isPartialDisabled) return;
                          setIsPartial(true);
                          const selectedKeys = Object.keys(sel);
                          if (selectedKeys.length > 1) {
                            const firstId = pending.find((p) => sel[p._id])?._id || selectedKeys[0];
                            setSel({ [firstId]: sel[firstId] });
                          }
                          if (!partialAmount) {
                            setPartialAmount(String(Math.round(grandTotal / 2)));
                          }
                        }}
                      />
                      <span>Partial Payment</span>
                    </label>
                  </div>

                  {hasAlreadyPaidPartial && (
                    <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--warn)', background: 'rgba(234, 88, 12, 0.08)', padding: '7px 10px', borderRadius: 6, border: '1px solid rgba(234, 88, 12, 0.25)', lineHeight: 1.4 }}>
                      ⚠️ <b>Partial payment disabled:</b> This instalment has a previous partial payment ({RS(selectedList.find((r) => (r.paid || 0) > 0)?.paid)} paid earlier). It must be completed in full.
                    </div>
                  )}

                  {effectiveIsPartial && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px dashed var(--line)', paddingTop: 10, marginTop: 10 }}>
                      <Field label="Amount paying now (₹)">
                        <Input
                          type="number"
                          min="1"
                          max={grandTotal - 1}
                          value={partialAmount}
                          onChange={(e) => setPartialAmount(e.target.value)}
                          placeholder={`e.g. ${Math.round(grandTotal / 2)}`}
                        />
                      </Field>
                      <div className="row" style={{ justifyContent: 'space-between', fontSize: 12 }}>
                        <span className="muted">Remaining balance:</span>
                        <b className="mono" style={{ color: 'var(--warn)', fontSize: 14 }}>
                          {RS(Math.max(0, grandTotal - (Number(partialAmount) || 0)))}
                        </b>
                      </div>
                      <div className="tiny muted" style={{ lineHeight: 1.35 }}>
                        Remaining balance will stay pending. Subsequent instalments cannot be selected until this balance is cleared.
                      </div>
                    </div>
                  )}
                </div>

                <Field label="Payment mode">
                  <Select value={pay.mode} onChange={(e) => setPay({ ...pay, mode: e.target.value })}>{MODES.map((m) => <option key={m}>{m}</option>)}</Select>
                </Field>
                <div className="row" style={{ gap: 8 }}>
                  <Field label="Date" style={{ flex: 1 }}><Input type="date" max={today} value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} /></Field>
                  <Field label="UTR / Cheque No" style={{ flex: 1 }}><Input value={pay.refNo} onChange={(e) => setPay({ ...pay, refNo: e.target.value })} placeholder="optional" /></Field>
                </div>
                <Field label="Remarks"><Input value={pay.remarks} onChange={(e) => setPay({ ...pay, remarks: e.target.value })} placeholder="optional" /></Field>
                <button type="button" className="btn btn-primary" disabled={busy || payableNow <= 0 || (effectiveIsPartial && (Number(partialAmount) <= 0 || Number(partialAmount) >= grandTotal))}
                  style={{ justifyContent: 'center', padding: 10 }} onClick={submit}>
                  {busy ? 'Saving…' : `Generate receipt (${RS(payableNow)})`}
                </button>
              </div>
            )}
          </Panel>
        </div>
      )}

      {receiptId && <ReceiptView id={receiptId} onClose={() => setReceiptId(null)} onChanged={loadStudent} />}
    </div>
  );
}
