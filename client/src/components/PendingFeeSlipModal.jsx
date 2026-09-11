import { useState } from 'react';
import { Drawer } from './ui';

export function getSlipStyles() {
  return `
    @page {
      size: A4 portrait;
      margin: 10mm 12mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
      margin: 0;
      padding: 0;
      color: #000;
      background: #fff;
    }
    .slip-box {
      border: 2px solid #000;
      padding: 14px 22px 18px 22px;
      background: #fff;
      margin-bottom: 22px;
      position: relative;
      page-break-inside: avoid;
    }
    .slip-top-header {
      display: flex;
      justify-content: center;
      position: relative;
    }
    .slip-school-name {
      font-size: 16.5px;
      font-weight: 900;
      letter-spacing: 0.04em;
      text-align: center;
      text-transform: uppercase;
    }
    .slip-session {
      position: absolute;
      right: 0;
      top: 0;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
    }
    .slip-address {
      text-align: center;
      font-size: 11.5px;
      margin-top: 3px;
      margin-bottom: 8px;
      color: #111;
    }
    .slip-black-banner {
      background: #000;
      color: #fff;
      text-align: center;
      font-weight: 800;
      font-size: 13.5px;
      letter-spacing: 0.06em;
      padding: 5px 10px;
      margin: 0 -22px 14px -22px;
      text-transform: uppercase;
    }
    .slip-content {
      font-size: 13px;
      line-height: 1.6;
    }
    .slip-dear {
      margin-bottom: 12px;
      font-size: 13px;
    }
    .slip-row {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 12px;
    }
    .slip-bold-field {
      font-weight: 800;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }
    .slip-amount-section {
      width: 290px;
      margin: 16px 50px 16px auto;
    }
    .slip-amt-row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      padding: 2px 0;
    }
    .slip-amt-val {
      font-family: Arial, monospace;
      font-size: 13.5px;
      font-weight: 600;
    }
    .slip-total-row {
      display: flex;
      justify-content: space-between;
      border-top: 1px solid #000;
      margin-top: 3px;
      padding-top: 3px;
      font-weight: 800;
    }
    .slip-double-underline {
      border-bottom: 3px double #000;
      display: inline-block;
      padding-bottom: 2px;
      font-weight: 800;
    }
    .slip-deposit-note {
      margin-top: 14px;
      font-size: 13px;
    }
    .slip-footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 32px;
      padding-top: 6px;
    }
    .slip-note-block {
      font-size: 12.5px;
    }
    .slip-signature {
      font-size: 11.5px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .cut-line {
      border-top: 1px dashed #777;
      margin: 18px 0;
      text-align: center;
      position: relative;
    }
    .cut-label {
      font-size: 10px;
      color: #666;
      background: #fff;
      padding: 0 10px;
      position: relative;
      top: -8px;
    }
    .page-break {
      page-break-after: always;
    }
  `;
}

export function renderSlipHTML({ row, school, note }) {
  const schoolName = (school?.name || 'THE PRIDE AND JOY PRESCHOOL').toUpperCase();
  const address = school?.address || '19/756, Sector-19, Munshipuliya, Indira Nagar, Lucknow';
  const session = school?.session
    ? (school.session.toLowerCase().includes('session') ? school.session : `Session - ${school.session}`)
    : 'Session - 2026-2027';
  const studentName = (row.student || '').toUpperCase();
  const fatherName = (row.father || '').toUpperCase();
  const rel = (row.gender || '').toUpperCase() === 'F' ? 'D/o' : 'S/o';
  const className = row.className || '—';
  const section = row.section || 'A';
  const monthName = row.month
    ? row.month.replace(/\s*\d{4}$/, '')
    : (row.dueDate ? new Date(row.dueDate).toLocaleString('en-IN', { month: 'long' }) : 'September');
  const amountStr = Number(row.balance || 0).toFixed(2);

  return `
    <div class="slip-box">
      <div class="slip-top-header">
        <div class="slip-school-name">${schoolName}</div>
        <div class="slip-session">${session}</div>
      </div>
      <div class="slip-address">${address}</div>
      
      <div class="slip-black-banner">
        PENDING FEE INFORMATION
      </div>

      <div class="slip-content">
        <div class="slip-dear">Dear Parent</div>
        
        <div class="slip-row">
          <span>This is to inform you that</span>
          <span class="slip-bold-field">${studentName}</span>
          <span>${rel}</span>
          <span class="slip-bold-field">${fatherName}</span>
        </div>

        <div class="slip-row" style="margin-top: 10px;">
          <span>of class</span>
          <span class="slip-bold-field">${className}</span>
          <span>Section</span>
          <span class="slip-bold-field">${section}</span>
          <span>has not deposited fee as metioned below :</span>
        </div>

        <div class="slip-amount-section">
          <div class="slip-amt-row">
            <span>${monthName}</span>
            <span class="slip-amt-val">${amountStr}</span>
          </div>
          <div class="slip-total-row">
            <span style="visibility: hidden;">Total</span>
            <span class="slip-amt-val slip-double-underline">${amountStr}</span>
          </div>
        </div>

        <div class="slip-deposit-note">
          Kindly deposit the fee as soon as possible.
        </div>

        <div class="slip-footer">
          <div class="slip-note-block">
            <b>Note :</b> <span>${note ? String(note).replace(/</g, '&lt;') : ''}</span>
          </div>
          <div class="slip-signature">
            PRINCIPAL'S SIGNATURE
          </div>
        </div>
      </div>
    </div>
  `;
}

export function printSlipDirect({ row, school, note }) {
  const content = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Pending Fee Information - ${row.student}</title>
        <style>${getSlipStyles()}</style>
      </head>
      <body>
        ${renderSlipHTML({ row, school, note })}
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
  doc.write(content);
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
}

export function printBulkSlips({ rows, school, note }) {
  if (!rows || rows.length === 0) return;

  const slipsHTML = [];
  for (let i = 0; i < rows.length; i++) {
    slipsHTML.push(renderSlipHTML({ row: rows[i], school, note }));
    // Add cut line if 1st on page (2 slips per page)
    if (i % 2 === 0 && i < rows.length - 1) {
      slipsHTML.push('<div class="cut-line"><span class="cut-label">✂ Cut along this line</span></div>');
    } else if (i % 2 === 1 && i < rows.length - 1) {
      slipsHTML.push('<div class="page-break"></div>');
    }
  }

  const content = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Pending Fee Information Slips (${rows.length} Students)</title>
        <style>${getSlipStyles()}</style>
      </head>
      <body>
        ${slipsHTML.join('')}
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
  doc.write(content);
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
}

export default function PendingFeeSlipModal({ row, school, onClose }) {
  const [note, setNote] = useState('');

  if (!row) return null;

  const schoolName = (school?.name || 'THE PRIDE AND JOY PRESCHOOL').toUpperCase();
  const address = school?.address || '19/756, Sector-19, Munshipuliya, Indira Nagar, Lucknow';
  const session = school?.session
    ? (school.session.toLowerCase().includes('session') ? school.session : `Session - ${school.session}`)
    : 'Session - 2026-2027';
  const studentName = (row.student || '').toUpperCase();
  const fatherName = (row.father || '').toUpperCase();
  const rel = (row.gender || '').toUpperCase() === 'F' ? 'D/o' : 'S/o';
  const className = row.className || '—';
  const section = row.section || 'A';
  const monthName = row.month
    ? row.month.replace(/\s*\d{4}$/, '')
    : (row.dueDate ? new Date(row.dueDate).toLocaleString('en-IN', { month: 'long' }) : 'September');
  const amountStr = Number(row.balance || 0).toFixed(2);

  const handlePrint = () => {
    printSlipDirect({ row, school, note });
  };

  const footer = (
    <div style={{ display: 'flex', gap: 10, width: '100%', alignItems: 'center' }}>
      <button
        type="button"
        className="btn btn-primary"
        onClick={handlePrint}
        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <span>🖨️</span> Print Slip / PDF
      </button>
      <div style={{ flex: 1 }} />
      <button type="button" className="btn btn-ghost" onClick={onClose}>
        Close
      </button>
    </div>
  );

  return (
    <Drawer
      title="Pending Fee Information Slip"
      sub={`${row.student} · ${row.admissionNo} · ${className}-${section}`}
      onClose={onClose}
      footer={footer}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Custom Note Input */}
        <div style={{ background: 'var(--surface-2)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--line)' }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)', display: 'block', marginBottom: 4 }}>
            Custom Note (Optional):
          </label>
          <input
            type="text"
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Kindly deposit by 15th to avoid late fee surcharge"
            style={{ width: '100%', fontSize: 12.5 }}
          />
        </div>

        {/* The Slip Card Preview */}
        <div style={{
          border: '2px solid #000',
          padding: '16px 20px',
          background: '#fff',
          color: '#000',
          fontFamily: 'Arial, sans-serif',
          boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
          borderRadius: 2,
        }}>
          {/* Top Header */}
          <div style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
            <div style={{ fontSize: 16, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center' }}>
              {schoolName}
            </div>
            <div style={{ position: 'absolute', right: 0, top: 0, fontSize: 11.5, fontWeight: 700 }}>
              {session}
            </div>
          </div>

          <div style={{ textAlign: 'center', fontSize: 11, marginTop: 2, marginBottom: 8, color: '#222' }}>
            {address}
          </div>

          {/* Black Banner */}
          <div style={{
            background: '#000',
            color: '#fff',
            textAlign: 'center',
            fontWeight: 800,
            fontSize: 13,
            letterSpacing: '0.06em',
            padding: '4px 10px',
            margin: '0 -20px 14px -20px',
            textTransform: 'uppercase',
          }}>
            PENDING FEE INFORMATION
          </div>

          {/* Body Content */}
          <div style={{ fontSize: 12.5, lineHeight: 1.6 }}>
            <div style={{ marginBottom: 10 }}>Dear Parent</div>

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '8px 14px' }}>
              <span>This is to inform you that</span>
              <span style={{ fontWeight: 800, fontSize: 13, textTransform: 'uppercase' }}>
                {studentName}
              </span>
              <span>{rel}</span>
              <span style={{ fontWeight: 800, fontSize: 13, textTransform: 'uppercase' }}>
                {fatherName}
              </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '8px 14px', marginTop: 8 }}>
              <span>of class</span>
              <span style={{ fontWeight: 800 }}>{className}</span>
              <span>Section</span>
              <span style={{ fontWeight: 800 }}>{section}</span>
              <span>has not deposited fee as metioned below :</span>
            </div>

            {/* Amount Section */}
            <div style={{ width: 260, margin: '14px 40px 14px auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>{monthName}</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{amountStr}</span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                borderTop: '1px solid #000',
                marginTop: 2,
                paddingTop: 2,
                fontWeight: 800,
              }}>
                <span style={{ visibility: 'hidden' }}>Total</span>
                <span style={{
                  fontFamily: 'monospace',
                  borderBottom: '3px double #000',
                  paddingBottom: 2,
                  display: 'inline-block',
                }}>
                  {amountStr}
                </span>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              Kindly deposit the fee as soon as possible.
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 28 }}>
              <div style={{ fontSize: 12 }}>
                <b>Note :</b> <span style={{ color: '#444' }}>{note || ''}</span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                PRINCIPAL'S SIGNATURE
              </div>
            </div>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
