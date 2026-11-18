import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { cachedGet } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Panel, Chip, Loading, ErrorBox, Empty, Input, Select } from '../components/ui';
import { RS, fmtDate, monthName, downloadCSV } from '../lib/format';

import PendingFeeSlipModal, { printBulkSlips } from '../components/PendingFeeSlipModal';
import { useTableFilter, FilterHead, FilterCount } from '../components/TableFilter';

const SELECT_HEADS = new Set(['Class', 'Instalment']);

const REPORTS = [
  { key: 'monthly-due', title: 'Monthly Due Report', desc: 'Which student owes how much, in a chosen month' },
  { key: 'daily-collection', title: 'Daily Collection', desc: 'Day-wise collection with payment-mode breakup' },
  { key: 'carry-forward', title: 'Carry Forward Report', desc: 'Unpaid balance brought forward from last session' },
];

export default function Reports() {
  const { can, user } = useAuth();
  const nav = useNavigate();
  const [key, setKey] = useState('monthly-due');
  const [classes, setClasses] = useState([]);
  const [f, setF] = useState({ month: new Date().toISOString().slice(0, 7), classId: '', from: '', to: '' });
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [activeSlip, setActiveSlip] = useState(null);

  useEffect(() => {
    document.title = 'Reports';
    cachedGet('/classes').then((d) => setClasses(d.classes)).catch(() => {});
  }, []);
  useEffect(() => {
    setData(null); setError(null);
    api.get(`/reports/${key}`, { params: f }).then(setData).catch(setError);
  }, [key, f.month, f.classId, f.from, f.to]);

  const meta = REPORTS.find((r) => r.key === key);

  const table = (() => {
    if (!data) return null;
    if (key === 'monthly-due') {
      return {
        head: ['Adm No', 'Student', 'Class', 'Father', 'Mobile', 'Instalment', 'Due date', 'Net due'],
        num: [false, false, false, false, false, false, false, true],
        rows: data.rows.map((r) => [r.admissionNo, r.student, r.className, r.father, r.phone, r.instNo, fmtDate(r.dueDate), r.balance]),
        ids: data.rows.map((r) => r.studentId),
        sortBy: { 6: (r) => new Date(r.dueDate).getTime() },
        footLabel: `Total due for ${monthName(f.month)}`,
      };
    }
    if (key === 'daily-collection') {
      return {
        head: ['Date', 'Receipts', 'Gross', 'Discount', 'Late fee', 'Net collected'],
        num: [false, true, true, true, true, true],
        rows: data.rows.map((r) => [fmtDate(r.date), r.receipts, r.gross, r.discount, r.lateFee, r.total]),
        ids: [],
        sortBy: { 0: (r) => new Date(r.date).getTime() },
        footLabel: 'Total collection',
        plain: [1],
      };
    }
    return {
      head: ['Adm No', 'Student', 'Class', 'Father', 'Mobile', 'C/F amount', 'Recovered', 'Still pending'],
      num: [false, false, false, false, false, true, true, true],
      rows: data.rows.map((r) => [r.admissionNo, r.student, r.className, r.father, r.phone, r.amount, r.recovered, r.pending]),
      ids: data.rows.map((r) => r.studentId),
      footLabel: 'Pending carry forward',
    };
  })();

  // One item per row so filtering/sorting keeps each row's student link and source record together.
  const items = table ? table.rows.map((cells, i) => ({ cells, id: table.ids[i], src: data.rows[i] })) : null;
  const columns = table ? [
    ...table.head.map((h, j) => ({
      key: `c${j}`,
      label: h,
      className: table.num[j] ? 't-right' : '',
      filter: SELECT_HEADS.has(h) ? 'select' : 'text',
      value: (it) => it.cells[j],
      sortValue: table.sortBy?.[j] ? (it) => table.sortBy[j](it.src) : undefined,
      placeholder: table.num[j] ? '>0' : undefined,
    })),
    ...(key === 'monthly-due' ? [{ key: 'slip', label: 'Notice Slip', className: 't-right', filter: 'none' }] : []),
  ] : [];
  const tf = useTableFilter(items, columns);
  useEffect(() => { tf.clear(); }, [key]); // filters belong to one report's columns
  const shown = tf.rows;
  const lastCol = table ? table.head.length - 1 : 0;
  const footTotal = tf.active ? shown.reduce((t, it) => t + (Number(it.cells[lastCol]) || 0), 0) : data?.total;

  return (
    <div className="stack">
      <Panel bodyless title="Reports" sub="Apply filters, review, then export as CSV for Excel"
        actions={(
          <>
            <Select style={{ width: 'auto' }} value={key} onChange={(e) => setKey(e.target.value)}>
              {REPORTS.map((r) => <option key={r.key} value={r.key}>{r.title}</option>)}
            </Select>
            {key === 'monthly-due' && (
              <Input type="month" style={{ width: 'auto' }} value={f.month} onChange={(e) => setF({ ...f, month: e.target.value })} />
            )}
            {key === 'daily-collection' && (
              <>
                <label className="row" style={{ gap: 5 }}><span className="lbl">From</span>
                  <Input type="date" style={{ width: 'auto' }} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
                <label className="row" style={{ gap: 5 }}><span className="lbl">To</span>
                  <Input type="date" style={{ width: 'auto' }} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
              </>
            )}
            {!user?.className && (
              <Select style={{ width: 'auto' }} value={f.classId} onChange={(e) => setF({ ...f, classId: e.target.value })}>
                <option value="">All classes</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            )}
            {can('export') && table?.rows?.length > 0 && (
              <button type="button" className="btn btn-sm" onClick={() => downloadCSV(`${key}.csv`, table.head, shown.map((it) => it.cells))}>Export CSV</button>
            )}
            {key === 'monthly-due' && shown.length > 0 && (
              <button
                type="button"
                className="btn btn-sm btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                onClick={() => printBulkSlips({ rows: shown.map((it) => it.src), school: data.school })}
                title="Bulk print pending fee notices for all students in this report"
              >
                <span>🖨️</span> Print All Slips ({shown.length})
              </button>
            )}
            <button type="button" className="btn btn-sm" onClick={() => window.print()}>Print</button>
          </>
        )}>
        <div className="panel-body" style={{ borderBottom: '1px solid var(--line)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <b>{meta.title}</b><span className="tiny muted">{meta.desc}</span>
          <div style={{ flex: 1 }} />
          {data?.note && <Chip tone="due">{data.note}</Chip>}
          <FilterCount tf={tf} />
          <span className="tag">{data ? `${data.rows.length} rows` : '…'}</span>
        </div>

        {error ? <ErrorBox error={error} /> : !data ? <Loading /> : (
          <div className="tbl-wrap">
            <table>
              <FilterHead columns={columns} tf={tf} />
              <tbody>
                {shown.length === 0 && <tr><td colSpan={columns.length}><Empty>No data for this filter.</Empty></td></tr>}
                {shown.map((it, i) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <tr key={i} className={it.id ? 'clickable' : ''} onClick={() => it.id && nav(`/students/${it.id}`)}>
                    {it.cells.map((cell, j) => (
                      // eslint-disable-next-line react/no-array-index-key
                      <td key={j} className={table.num[j] ? 'num' : ''}>
                        {table.num[j] && !(table.plain || []).includes(j) ? RS(cell) : cell}
                      </td>
                    ))}
                    {key === 'monthly-due' && (
                      <td className="t-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{
                            padding: '3px 8px',
                            fontSize: 11.5,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            borderColor: 'var(--brand)',
                            color: 'var(--brand)',
                            fontWeight: 600,
                          }}
                          onClick={() => setActiveSlip(it.src)}
                          title="View and print pending fee information slip"
                        >
                          <span>📄</span> View Slip
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              {data.total !== undefined && (
                <tfoot>
                  <tr style={{ background: 'var(--surface-2)' }}>
                    <td colSpan={table.head.length - 1} style={{ fontWeight: 700 }}>{table.footLabel}</td>
                    <td className="num" style={{ fontWeight: 700, fontSize: 15 }}>{RS(footTotal)}</td>
                    {key === 'monthly-due' && <td />}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </Panel>

      {activeSlip && (
        <PendingFeeSlipModal
          row={activeSlip}
          school={data?.school}
          onClose={() => setActiveSlip(null)}
        />
      )}

      <Panel title="All reports">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10 }}>
          {REPORTS.map((r) => (
            <button key={r.key} type="button" className="btn" onClick={() => setKey(r.key)}
              style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '11px 13px', textAlign: 'left',
                ...(r.key === key ? { borderColor: 'var(--brand)', background: 'var(--brand-soft)' } : {}) }}>
              <b style={{ fontSize: 13 }}>{r.title}</b>
              <span className="tiny muted" style={{ fontWeight: 400 }}>{r.desc}</span>
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}
