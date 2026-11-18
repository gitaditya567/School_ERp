import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Panel, Kpi, Loading, ErrorBox, Empty, Drawer, Field, Input, Select } from '../components/ui';
import { RS, fmtDate, monthName } from '../lib/format';
import { useTableFilter, FilterHead, FilterCount } from '../components/TableFilter';

const DB_COLUMNS = [
  { key: 'date', label: 'Date', value: (e) => fmtDate(e.date), sortValue: (e) => new Date(e.date).getTime() },
  { key: 'what', label: 'Particulars', value: (e) => `${e.title || ''} ${e.ref || ''}`, sortValue: (e) => e.title },
  { key: 'head', label: 'Head / Mode', filter: 'select', value: (e) => e.sub },
  { key: 'in', label: 'Receipt (Dr)', className: 't-right', value: (e) => (e.kind === 'in' ? e.amount : null), placeholder: '>0' },
  { key: 'out', label: 'Payment (Cr)', className: 't-right', value: (e) => (e.kind === 'out' ? e.amount : null), placeholder: '>0' },
];

const HEADS = ['Staff Salary', 'Rent', 'Electricity', 'Teaching Material', 'Maintenance', 'Transport', 'Marketing', 'Misc'];
const MODES = ['Bank Transfer', 'UPI', 'Cash', 'Cheque'];
const monthsBack = (n) => {
  const out = []; const d = new Date();
  for (let i = 0; i < n; i += 1) out.push(new Date(d.getFullYear(), d.getMonth() - i, 1).toISOString().slice(0, 7));
  return out;
};

export default function DayBook() {
  const { can } = useAuth();
  const { toast, error: shout } = useToast();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(null);

  const load = () => { setError(null); api.get('/expenses', { params: { month } }).then(setData).catch(setError); };
  useEffect(() => { document.title = 'Day Book'; }, []);
  useEffect(() => { load(); }, [month]);

  const allEntries = useMemo(() => (data ? [
    ...data.receipts.map((r) => ({ id: r._id, date: r.date, kind: 'in', title: r.student?.name, sub: `Fee income · ${r.mode}`, ref: r.receiptNo, amount: r.total })),
    ...data.expenses.map((e) => ({ id: e._id, date: e.date, kind: 'out', title: e.particulars || e.head, sub: `${e.head} · ${e.mode}`, ref: e.voucherNo, amount: e.amount })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date)) : null), [data]);
  const tf = useTableFilter(allEntries, DB_COLUMNS);

  if (error) return <ErrorBox error={error} onRetry={load} />;
  if (!data) return <Loading />;

  const entries = tf.rows;
  const sum = (kind) => entries.filter((e) => e.kind === kind).reduce((t, e) => t + e.amount, 0);
  const totalIn = tf.active ? sum('in') : data.income;
  const totalOut = tf.active ? sum('out') : data.outgo;

  const save = async (body) => {
    try { await api.post('/expenses', body); setForm(null); load(); toast('Expense voucher saved'); }
    catch (e) { shout(e); }
  };

  return (
    <div className="stack">
      <div className="kpis">
        <Kpi label="Receipts (in)" value={RS(data.income)} color="var(--good)" foot={<span>{data.receipts.length} fee receipts</span>} />
        <Kpi label="Payments (out)" value={RS(data.outgo)} color="var(--crit)" foot={<span>{data.expenses.length} vouchers</span>} />
        <Kpi accent label="Net balance" value={RS(data.net)} foot={<span>{monthName(month)}</span>} />
        <Kpi label="Largest expense" value={<span style={{ fontSize: 19 }}>{[...data.expenses].sort((a, b) => b.amount - a.amount)[0]?.head || '—'}</span>}
          foot={<span>{RS([...data.expenses].sort((a, b) => b.amount - a.amount)[0]?.amount || 0)}</span>} />
      </div>

      <Panel bodyless title="Day Book" sub={<>Fee income and school expenses in one place <FilterCount tf={tf} /></>}
        actions={(
          <>
            <Select style={{ width: 'auto' }} value={month} onChange={(e) => setMonth(e.target.value)}>
              {monthsBack(12).map((m) => <option key={m} value={m}>{monthName(m)}</option>)}
            </Select>
            {can('addExpense')
              ? <button type="button" className="btn btn-sm" onClick={() => setForm({})}>+ Expense voucher</button>
              : <span className="locked-note">Vouchers locked for your role</span>}
          </>
        )}>
        <div className="tbl-wrap">
          <table>
            <FilterHead columns={DB_COLUMNS} tf={tf} />
            <tbody>
              {entries.length === 0 && <tr><td colSpan={5}><Empty>No entries for this month.</Empty></td></tr>}
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="tiny nw">{fmtDate(e.date)}</td>
                  <td><b>{e.title}</b><div className="tiny mono" style={{ color: 'var(--brand)' }}>{e.ref}</div></td>
                  <td className="tiny">{e.sub}</td>
                  <td className="num" style={e.kind === 'in' ? { color: 'var(--good)', fontWeight: 600 } : { color: 'var(--text-3)' }}>{e.kind === 'in' ? RS(e.amount) : '—'}</td>
                  <td className="num" style={e.kind === 'out' ? { color: 'var(--crit)', fontWeight: 600 } : { color: 'var(--text-3)' }}>{e.kind === 'out' ? RS(e.amount) : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--surface-2)' }}>
                <td colSpan={3} style={{ fontWeight: 700 }}>Total</td>
                <td className="num" style={{ fontWeight: 700, color: 'var(--good)' }}>{RS(totalIn)}</td>
                <td className="num" style={{ fontWeight: 700, color: 'var(--crit)' }}>{RS(totalOut)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Panel>

      {form && <ExpenseForm onClose={() => setForm(null)} onSave={save} />}
    </div>
  );
}

function ExpenseForm({ onSave, onClose }) {
  const [f, setF] = useState({ date: new Date().toISOString().slice(0, 10), head: HEADS[0], particulars: '', amount: '', mode: MODES[0] });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Drawer title="New expense voucher" sub="Day Book" onClose={onClose} footer={(
      <>
        <button type="button" className="btn btn-primary" onClick={() => onSave({ ...f, amount: Number(f.amount) })}>Save voucher</button>
        <div style={{ flex: 1 }} />
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </>
    )}>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Field label="Date"><Input type="date" value={f.date} onChange={set('date')} /></Field>
        <Field label="Head"><Select value={f.head} onChange={set('head')}>{HEADS.map((h) => <option key={h}>{h}</option>)}</Select></Field>
        <Field label="Particulars" style={{ gridColumn: '1/-1' }}><Input value={f.particulars} onChange={set('particulars')} placeholder="e.g. September salary – 9 staff" /></Field>
        <Field label="Amount"><Input className="input num" inputMode="numeric" value={f.amount}
          onChange={(e) => setF({ ...f, amount: e.target.value.replace(/\D/g, '') })} /></Field>
        <Field label="Mode"><Select value={f.mode} onChange={set('mode')}>{MODES.map((m) => <option key={m}>{m}</option>)}</Select></Field>
      </div>
    </Drawer>
  );
}
