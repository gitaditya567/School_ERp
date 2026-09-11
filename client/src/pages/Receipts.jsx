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
  useEffect(() => {
    const delay = f.search ? 220 : 0;
    const t = setTimeout(load, delay);
    return () => clearTimeout(t);
  }, [f.search, f.from, f.to, f.mode]);

  if (error) return <ErrorBox error={error} onRetry={load} />;
  if (!data) return <Loading />;
  const { receipts, totals, nextReceiptNo } = data;
  const hasCancelled = receipts.some((r) => r.cancelled?.at);

  const exportCSV = () => {
    const head = ['Receipt No', 'Date', 'Student', 'Class', 'Type / Instalments', 'Mode', 'Collected By', 'Gross', 'Discount', 'Late', 'Received', 'Status'];
    const rows = receipts.map((r) => [
      r.receiptNo,
      fmtDate(r.date),
      r.student?.name,
      r.classId?.name,
      r.type === 'misc' ? `Other: ${r.miscHead || 'Misc'}` : r.lines.map((l) => l.instNo).join(' '),
      r.mode,
      r.collectedBy?.name || '',
      r.gross,
      r.discount,
      r.lateFee,
      r.total,
      r.cancelled?.at ? 'Cancelled' : (r.type === 'misc' ? 'Other Fee' : 'Valid'),
    ]);
    rows.push(['Total (Active)', '', '', '', '', '', '', totals.gross, totals.discount, totals.lateFee, totals.total, '']);
    downloadCSV('receipts.csv', head, rows);
  };

  const exportPDF = () => {
    const schoolName = data?.school?.name || 'Pride & Joy Pre-School';
    const schoolBranch = data?.school?.branch || '';
    const schoolPhone = data?.school?.phone || '';
    const session = data?.school?.session || '';
    const dateRangeStr = f.from || f.to
      ? `${f.from ? fmtDate(f.from) : 'Beginning'} to ${f.to ? fmtDate(f.to) : 'Present'}`
      : 'All dates';
    const modeStr = f.mode || 'All modes';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Receipt Register - ${schoolName}</title>
          <style>
            @page {
              size: A4 landscape;
              margin: 10mm 10mm 12mm 10mm;
            }
            * { box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
              font-size: 11px;
              color: #1f2937;
              margin: 0;
              padding: 0;
              line-height: 1.35;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 2px solid #B01B5C;
              padding-bottom: 8px;
              margin-bottom: 12px;
            }
            .school-title {
              font-size: 18px;
              font-weight: 800;
              color: #B01B5C;
              text-transform: uppercase;
              letter-spacing: -0.01em;
            }
            .school-sub {
              font-size: 10.5px;
              color: #6b7280;
              margin-top: 2px;
            }
            .doc-title-block {
              text-align: right;
            }
            .doc-title {
              font-size: 14px;
              font-weight: 800;
              color: #111827;
              letter-spacing: 0.04em;
              text-transform: uppercase;
            }
            .doc-meta {
              font-size: 10px;
              color: #6b7280;
              margin-top: 2px;
            }
            .filter-bar {
              display: flex;
              gap: 16px;
              background: #fdf2f8;
              border: 1px solid #fbcfe8;
              border-radius: 6px;
              padding: 6px 12px;
              margin-bottom: 12px;
              font-size: 11px;
            }
            .filter-bar div b {
              color: #B01B5C;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 10.5px;
            }
            th {
              background: #f3f4f6;
              color: #4b5563;
              text-align: left;
              padding: 6px 7px;
              border: 1px solid #d1d5db;
              font-size: 10px;
              text-transform: uppercase;
              font-weight: 700;
              letter-spacing: 0.02em;
            }
            th.num, td.num {
              text-align: right;
              font-family: "Courier New", Courier, monospace;
            }
            td {
              padding: 5px 7px;
              border: 1px solid #e5e7eb;
              vertical-align: middle;
            }
            tr:nth-child(even) td {
              background: #fcfcfd;
            }
            .cancelled-row td {
              opacity: 0.65;
              background: #fef2f2 !important;
            }
            .mono {
              font-family: "Courier New", Courier, monospace;
            }
            .badge {
              display: inline-block;
              padding: 1px 5px;
              border-radius: 3px;
              font-size: 9px;
              font-weight: 700;
            }
            .badge-canc {
              background: #fee2e2;
              color: #991b1b;
              border: 1px solid #fca5a5;
            }
            .badge-misc {
              background: #fdf2f8;
              color: #B01B5C;
              border: 1px solid #fbcfe8;
            }
            tfoot tr td {
              background: #f9fafb !important;
              border-top: 2px solid #B01B5C;
              font-weight: 700;
              padding: 7px 7px;
            }
            .tfoot-total {
              font-size: 12px;
              color: #B01B5C;
              font-weight: 800;
            }
            .summary-cards {
              display: flex;
              gap: 12px;
              margin-top: 14px;
              justify-content: flex-end;
            }
            .summary-card {
              border: 1px solid #e5e7eb;
              background: #f9fafb;
              border-radius: 6px;
              padding: 6px 12px;
              min-width: 110px;
              text-align: center;
            }
            .summary-card .val {
              font-size: 13px;
              font-weight: 800;
              color: #B01B5C;
              font-family: "Courier New", Courier, monospace;
            }
            .summary-card .lbl {
              font-size: 9.5px;
              color: #6b7280;
              text-transform: uppercase;
              font-weight: 600;
            }
            .footer-note {
              margin-top: 14px;
              border-top: 1px solid #e5e7eb;
              padding-top: 6px;
              display: flex;
              justify-content: space-between;
              font-size: 9.5px;
              color: #9ca3af;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="school-title">${schoolName}</div>
              <div class="school-sub">${[schoolBranch, schoolPhone, session ? `Session: ${session}` : ''].filter(Boolean).join(' · ')}</div>
            </div>
            <div class="doc-title-block">
              <div class="doc-title">Receipt Register Report</div>
              <div class="doc-meta">Printed on: ${new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div>
            </div>
          </div>

          <div class="filter-bar">
            <div>Range: <b>${dateRangeStr}</b></div>
            <div>Mode: <b>${modeStr}</b></div>
            ${f.search ? `<div>Search: <b>${f.search}</b></div>` : ''}
            <div>Total Records: <b>${receipts.length}</b> (${totals.count} active${hasCancelled ? `, ${receipts.length - totals.count} cancelled` : ''})</div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 30px;">#</th>
                <th>Receipt No</th>
                <th>Date</th>
                <th>Student</th>
                <th>Class</th>
                <th>Type / Particulars</th>
                <th>Mode</th>
                <th>Collected By</th>
                <th class="num">Gross</th>
                <th class="num">Disc.</th>
                <th class="num">Late Fee</th>
                <th class="num">Received</th>
                <th style="text-align: center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${receipts.map((r, i) => {
                const isCanc = Boolean(r.cancelled?.at);
                return `
                  <tr class="${isCanc ? 'cancelled-row' : ''}">
                    <td>${i + 1}</td>
                    <td class="mono" style="font-weight: 700; color: #B01B5C;">
                      ${r.receiptNo}
                    </td>
                    <td>${fmtDate(r.date)}</td>
                    <td style="font-weight: 600;">${r.student?.name || '—'}</td>
                    <td>${r.classId?.name || '—'}</td>
                    <td>
                      ${r.type === 'misc'
                        ? `<span class="badge badge-misc">Other: ${r.miscHead || 'Misc'}</span>`
                        : (r.lines || []).map((l) => l.instNo).join(', ')}
                    </td>
                    <td>${r.mode}</td>
                    <td>${r.collectedBy?.name || '—'}</td>
                    <td class="num">${RS(r.gross)}</td>
                    <td class="num" style="color: #B01B5C;">${r.discount ? `−${RS(r.discount)}` : '—'}</td>
                    <td class="num">${r.lateFee ? RS(r.lateFee) : '—'}</td>
                    <td class="num" style="font-weight: 700;">${RS(r.total)}</td>
                    <td style="text-align: center;">
                      ${isCanc
                        ? `<span class="badge badge-canc">Cancelled</span>`
                        : r.type === 'misc'
                          ? `<span class="badge badge-misc">Other Fee</span>`
                          : 'Valid'}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="8" style="text-align: right; font-weight: 700;">
                  Total ${hasCancelled ? '(Active Receipts)' : ''}:
                </td>
                <td class="num" style="font-weight: 700;">${RS(totals.gross)}</td>
                <td class="num" style="font-weight: 700; color: #B01B5C;">${totals.discount ? `−${RS(totals.discount)}` : '—'}</td>
                <td class="num" style="font-weight: 700;">${totals.lateFee ? RS(totals.lateFee) : '—'}</td>
                <td class="num tfoot-total">${RS(totals.total)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>

          <div class="summary-cards">
            <div class="summary-card">
              <div class="lbl">Active Receipts</div>
              <div class="val">${totals.count}</div>
            </div>
            <div class="summary-card">
              <div class="lbl">Total Gross</div>
              <div class="val">${RS(totals.gross)}</div>
            </div>
            <div class="summary-card">
              <div class="lbl">Total Discount</div>
              <div class="val" style="color: #B01B5C;">${RS(totals.discount)}</div>
            </div>
            <div class="summary-card">
              <div class="lbl">Late Fee</div>
              <div class="val">${RS(totals.lateFee)}</div>
            </div>
            <div class="summary-card" style="border-color: #B01B5C; background: #fdf2f8;">
              <div class="lbl">Net Collected</div>
              <div class="val" style="font-size: 15px;">${RS(totals.total)}</div>
            </div>
          </div>

          <div class="footer-note">
            <span>Official Computer-Generated Receipt Register</span>
            <span>Page 1 of 1 · Pride & Joy School ERP</span>
          </div>
        </body>
      </html>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(htmlContent);
    doc.close();

    iframe.contentWindow.focus();
    setTimeout(() => {
      iframe.contentWindow.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 2000);
    }, 250);
  };

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
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={exportCSV}
                  title="Download CSV spreadsheet"
                >
                  Export CSV
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={exportPDF}
                  title="Export and Print PDF report"
                >
                  Export PDF
                </button>
              </div>
            )}
          </>
        )}>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr><th>Receipt No</th><th>Date</th><th>Student</th><th>Class</th><th>Instalments / Head</th><th>Mode</th><th>By</th>
                <th className="t-right">Gross</th><th className="t-right">Disc.</th><th className="t-right">Late</th><th className="t-right">Received</th></tr>
            </thead>
            <tbody>
              {receipts.length === 0 && <tr><td colSpan={11}><Empty>No receipts in this range.</Empty></td></tr>}
              {receipts.map((r) => (
                <tr key={r._id} className="clickable" onClick={() => setOpen(r._id)}
                  style={r.cancelled?.at ? { opacity: 0.55 } : undefined}>
                  <td className="mono" style={{ color: 'var(--brand)', fontWeight: 600 }}>
                    {r.receiptNo}
                    {r.type === 'misc' && <div><Chip tone="part">Other: {r.miscHead || 'Misc'}</Chip></div>}
                    {r.cancelled?.at && <div><Chip tone="over">Cancelled</Chip></div>}
                  </td>
                  <td className="tiny nw">{fmtDate(r.date)}</td>
                  <td style={{ fontWeight: 600 }}>{r.student?.name}</td>
                  <td><span className="tag">{r.classId?.name}</span></td>
                  <td className="mono tiny">
                    {r.type === 'misc' ? (
                      <span style={{ color: 'var(--brand)', fontWeight: 600 }}>{r.miscHead || 'Misc Fee'}</span>
                    ) : (
                      r.lines.map((l) => l.instNo).join(', ')
                    )}
                  </td>
                  <td className="tiny">{r.mode}</td>
                  <td className="tiny muted">{r.collectedBy?.name}</td>
                  <td className="num">{RS(r.gross)}</td>
                  <td className="num" style={{ color: 'var(--brand)' }}>{r.discount ? `−${RS(r.discount)}` : '—'}</td>
                  <td className="num">{r.lateFee ? RS(r.lateFee) : '—'}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{RS(r.total)}</td>
                </tr>
              ))}
            </tbody>
            {receipts.length > 0 && (
              <tfoot>
                <tr style={{ background: 'var(--surface-2)', borderTop: '2px solid var(--line)', fontWeight: 700 }}>
                  <td colSpan={7} style={{ textAlign: 'right', padding: '10px 8px', fontWeight: 700 }}>
                    Total {hasCancelled ? '(Active)' : ''}:
                  </td>
                  <td className="num" style={{ fontWeight: 700, padding: '10px 8px' }}>
                    {RS(totals.gross)}
                  </td>
                  <td className="num" style={{ fontWeight: 700, color: 'var(--brand)', padding: '10px 8px' }}>
                    {totals.discount ? `−${RS(totals.discount)}` : '—'}
                  </td>
                  <td className="num" style={{ fontWeight: 700, padding: '10px 8px' }}>
                    {totals.lateFee ? RS(totals.lateFee) : '—'}
                  </td>
                  <td className="num" style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--brand)', padding: '10px 8px' }}>
                    {RS(totals.total)}
                  </td>
                </tr>
              </tfoot>
            )}
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
