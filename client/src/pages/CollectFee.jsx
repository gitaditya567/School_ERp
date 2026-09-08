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
const today = new Date().toISOString().slice(0, 10);

export default function CollectFee() {
  const [params, setParams] = useSearchParams();
  const studentId = params.get('student');
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

  useEffect(() => { document.title = 'Collect Fee'; }, []);
  useEffect(() => {
    if (studentId) return;
    const delay = search ? 220 : 0;
    const id = setTimeout(() => api.get('/students', { params: { search } }).then((d) => setList(d.students)).catch(shout), delay);
    return () => clearTimeout(id);
  }, [search, studentId]);

  const loadStudent = () => {
    setData(null); setSel({});
    api.get(`/fee/pending/${studentId}`, { params: { date: pay.date } }).then(setData).catch(shout);
  };
  useEffect(() => { if (studentId) loadStudent(); }, [studentId, pay.date]);

  /* -------------------- student picker -------------------- */
  if (!studentId) {
    return (
      <Panel bodyless title="Collect Fee" sub="Pick a student, select instalments, apply any concession and generate the receipt"
        actions={<Input style={{ width: 230 }} autoFocus placeholder="Name / Adm. No / Mobile" value={search} onChange={(e) => setSearch(e.target.value)} />}>
        {!list ? <Loading /> : (
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Adm. No</th><th>Student</th><th>Class</th><th>Father</th><th className="t-right">Outstanding</th><th>Status</th><th /></tr></thead>
              <tbody>
                {list.length === 0 && <tr><td colSpan={7}><Empty>No matching student.</Empty></td></tr>}
                {list.map((s) => (
                  <tr key={s._id} className="clickable" onClick={() => setParams({ student: s._id })}>
                    <td className="mono tiny">{s.admissionNo}</td>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td><span className="tag">{s.classId?.name}</span></td>
                    <td>{s.father}</td>
                    <td className="num" style={{ fontWeight: 700, color: s.totals.outstanding ? 'var(--warn)' : 'var(--text-3)' }}>{RS(s.totals.outstanding)}</td>
                    <td>{s.totals.overdue > 0 ? <Chip tone="over">Overdue</Chip> : s.totals.outstanding > 0 ? <Chip tone="due">Due</Chip> : <Chip tone="paid">Clear</Chip>}</td>
                    <td className="t-right"><button type="button" className="btn btn-sm btn-primary">Select →</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    );
  }

  if (!data) return <Loading />;
  const { student, rows, school } = data;
  const pending = rows.filter((r) => r.balance > 0);
  const outstanding = pending.reduce((s, r) => s + r.balance, 0);

  const toggle = (row) => setSel((p) => {
    const n = { ...p };
    if (n[row._id]) delete n[row._id];
    else n[row._id] = { discount: 0, discountReason: '', lateFee: row.suggestedLateFee };
    return n;
  });
  const patch = (id, k, v) => setSel((p) => ({ ...p, [id]: { ...p[id], [k]: v } }));

  const totals = Object.entries(sel).reduce((t, [id, v]) => {
    const row = rows.find((r) => r._id === id);
    if (!row) return t;
    t.gross += row.balance; t.discount += Number(v.discount) || 0; t.lateFee += Number(v.lateFee) || 0;
    return t;
  }, { gross: 0, discount: 0, lateFee: 0 });
  const grandTotal = Math.max(0, totals.gross - totals.discount + totals.lateFee);

  const submit = async () => {
    setBusy(true);
    try {
      const res = await api.post('/fee/collect', {
        studentId, date: pay.date, mode: pay.mode, refNo: pay.refNo, remarks: pay.remarks,
        lines: Object.entries(sel).map(([ledgerId, v]) => ({ ledgerId, ...v })),
      });
      toast(`Receipt ${res.receipt.receiptNo} generated · ${RS(res.receipt.total)}`);
      setReceiptId(res.receipt._id);
      loadStudent();
    } catch (e) { shout(e); } finally { setBusy(false); }
  };

  return (
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
                {pending.map((r) => {
                  const on = Boolean(sel[r._id]);
                  const v = sel[r._id] || {};
                  const st = statusOf(r);
                  const cap = Math.min(r.balance, maxDiscount);
                  return (
                    <tr key={r._id} style={on ? { background: 'var(--brand-soft)' } : undefined}>
                      <td><input type="checkbox" checked={on} onChange={() => toggle(r)} aria-label={`Select instalment ${r.instNo}`} /></td>
                      <td><b className="mono">{r.instNo}</b>{r.isCarryForward && <div className="tiny" style={{ color: 'var(--warn)' }}>C/F</div>}</td>
                      <td className="tiny nw">{r.month}<div className="tiny muted nw">Due {fmtDate(r.dueDate)}</div></td>
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
            <button type="button" className="btn btn-sm" onClick={() => setSel(Object.fromEntries(pending.map((r) => [r._id, { discount: 0, discountReason: '', lateFee: r.suggestedLateFee }])))}>Select all</button>
            <button type="button" className="btn btn-sm" onClick={() => setSel(Object.fromEntries(pending.filter((r) => ['over', 'due'].includes(statusOf(r).k)).map((r) => [r._id, { discount: 0, discountReason: '', lateFee: r.suggestedLateFee }])))}>Due + overdue only</button>
            <button type="button" className="btn btn-sm" onClick={() => setSel({})}>Clear</button>
            <div style={{ flex: 1 }} />
            <span className="locked-note">
              {maxDiscount === Infinity ? 'You can approve any concession'
                : maxDiscount > 0 ? `Concession limit ${RS(maxDiscount)} — above that needs the Principal`
                  : 'Concession locked for your role'}
            </span>
          </div>
        </Panel>
      </div>

      <Panel title="Payment summary" sub={school.lateFeeAmount ? `Late fee ${RS(school.lateFeeAmount)} after the ${school.lateFeeFrom}th` : undefined}
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
            <Field label="Payment mode">
              <Select value={pay.mode} onChange={(e) => setPay({ ...pay, mode: e.target.value })}>{MODES.map((m) => <option key={m}>{m}</option>)}</Select>
            </Field>
            <div className="row" style={{ gap: 8 }}>
              <Field label="Date" style={{ flex: 1 }}><Input type="date" max={today} value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} /></Field>
              <Field label="UTR / Cheque No" style={{ flex: 1 }}><Input value={pay.refNo} onChange={(e) => setPay({ ...pay, refNo: e.target.value })} placeholder="optional" /></Field>
            </div>
            <Field label="Remarks"><Input value={pay.remarks} onChange={(e) => setPay({ ...pay, remarks: e.target.value })} placeholder="optional" /></Field>
            <button type="button" className="btn btn-primary" disabled={busy || grandTotal <= 0}
              style={{ justifyContent: 'center', padding: 10 }} onClick={submit}>
              {busy ? 'Saving…' : 'Generate receipt'}
            </button>
          </div>
        )}
      </Panel>

      {receiptId && <ReceiptView id={receiptId} onClose={() => setReceiptId(null)} onChanged={loadStudent} />}
    </div>
  );
}
