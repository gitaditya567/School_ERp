import { RS, RS0, fmtDate } from './format';

/**
 * Cleanly prints an isolated HTML document using a hidden iframe.
 * Guarantees that only the slip content prints, with no surrounding web app UI,
 * no drawers, no navigation, and no URL footers.
 */
export function printSlipHTML(htmlContent, title = 'Print Slip') {
  let iframe = document.getElementById('slip-print-iframe');
  if (iframe && document.body.contains(iframe)) {
    document.body.removeChild(iframe);
  }

  iframe = document.createElement('iframe');
  iframe.id = 'slip-print-iframe';
  iframe.style.position = 'fixed';
  iframe.style.top = '0';
  iframe.style.left = '0';
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  iframe.style.zIndex = '-99999';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
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
    }, 3000);
  }, 250);
}

export function getSlipBaseStyles() {
  return `
    @page {
      size: A4 portrait;
      margin: 10mm 12mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
      color: #1E1826;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      padding: 10px;
    }
    .mono {
      font-family: "Courier New", Courier, monospace;
      font-weight: 600;
    }
    .cut-line {
      border-top: 1.5px dashed #888;
      margin: 22px 0 18px 0;
      text-align: center;
      position: relative;
    }
    .cut-label {
      position: relative;
      top: -10px;
      background: #fff;
      padding: 0 12px;
      font-size: 11px;
      color: #666;
      font-style: italic;
    }
    .page-break {
      page-break-before: always;
    }
  `;
}

/**
 * Formats a fee receipt as HTML for slip-only printing
 */
export function renderReceiptHTML({ receipt: r, school = {}, amountInWords = '', copyTitle = '' }) {
  const schoolName = (school.name || 'THE PRIDE AND JOY PRESCHOOL').toUpperCase();
  const branch = school.branch ? ` · ${school.branch}` : '';
  const phone = school.phone ? ` · Phone: ${school.phone}` : '';
  const email = school.email ? ` · ${school.email}` : '';
  const receiptTitle = r.type === 'misc' ? 'MISCELLANEOUS RECEIPT' : 'FEE RECEIPT';
  const logo = school.logo;

  const isMisc = r.type === 'misc';
  const lines = isMisc
    ? (r.lines || [{ head: r.miscHead, net: r.total, reason: r.remarks }])
    : (r.lines || []);

  return `
    <div class="receipt-slip-box" style="
      border: 1.5px solid #2C1930;
      border-radius: 8px;
      padding: 16px 20px;
      background: #fff;
      color: #1E1826;
      margin-bottom: 14px;
      page-break-inside: avoid;
    ">
      ${copyTitle ? `
        <div style="text-align: right; margin-bottom: 6px;">
          <span style="
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            padding: 3px 8px;
            border-radius: 4px;
            background: #F4EFF6;
            color: #B01B5C;
            border: 1px solid #D9D2E0;
          ">${copyTitle}</span>
        </div>
      ` : ''}

      <!-- Header -->
      <div style="display: flex; gap: 14px; align-items: flex-start; border-bottom: 2px solid #B01B5C; padding-bottom: 10px;">
        ${logo
          ? `<img src="${logo}" alt="" style="width: 46px; height: 46px; object-fit: contain;" />`
          : `<div style="width: 44px; height: 44px; border-radius: 8px; background: #B01B5C; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 18px;">
              ${(school.name || 'SC').slice(0, 2).toUpperCase()}
            </div>`}
        <div style="flex: 1;">
          <div style="font-weight: 900; font-size: 17px; letter-spacing: 0.02em; color: #2C1930;">${schoolName}</div>
          <div style="font-size: 11px; color: #555; margin-top: 2px;">${[school.address || school.branch, school.phone, school.email].filter(Boolean).join(' · ')}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 10px; letter-spacing: .08em; color: #666; font-weight: 800;">${receiptTitle}</div>
          <div class="mono" style="font-size: 15px; font-weight: 800; color: #B01B5C; margin: 2px 0;">${r.receiptNo || '—'}</div>
          <div style="font-size: 11px; color: #555;">Date: <b>${fmtDate(r.date)}</b></div>
        </div>
      </div>

      ${r.cancelled?.at ? `
        <div style="margin: 10px 0; padding: 6px 10px; border: 1px solid #B3271E; color: #B3271E; border-radius: 6px; font-size: 11.5px; font-weight: 700; background: #fdf2f2;">
          CANCELLED on ${fmtDate(r.cancelled.at)} — ${r.cancelled.reason || 'Cancelled'}
        </div>
      ` : ''}

      <!-- Metadata Grid -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px 16px; font-size: 12px; margin: 12px 0; padding-bottom: 10px; border-bottom: 1px dashed #D9D2E0;">
        <div><span style="color: #666;">Student:</span> <b>${r.student?.name || '—'}</b></div>
        <div><span style="color: #666;">Adm. No:</span> <b class="mono" style="color: #B01B5C;">${r.student?.admissionNo || '—'}</b></div>
        <div><span style="color: #666;">Class:</span> <b>${r.classId?.name || '—'}-${r.student?.section || 'A'}</b></div>
        <div><span style="color: #666;">Father:</span> <b>${r.student?.father || '—'}</b></div>
        <div><span style="color: #666;">Session:</span> <b>${school.session || '—'}</b></div>
        <div><span style="color: #666;">Payment Mode:</span> <b>${r.mode || 'Cash'}</b> ${r.refNo ? `<span class="mono" style="font-size: 10.5px; color: #666;">(${r.refNo})</span>` : ''}</div>
      </div>

      <!-- Items Table -->
      <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 10px;">
        <thead>
          <tr style="background: #F4EFF6; border-bottom: 1.5px solid #D9D2E0;">
            ${isMisc ? `
              <th style="padding: 6px 8px; text-align: left; color: #444;">Particulars / Fee Head</th>
              <th style="padding: 6px 8px; text-align: left; color: #444;">Remarks</th>
              <th style="padding: 6px 8px; text-align: right; color: #444;">Amount (₹)</th>
            ` : `
              <th style="padding: 6px 8px; text-align: left; color: #444;">Inst.</th>
              <th style="padding: 6px 8px; text-align: left; color: #444;">Due Month</th>
              <th style="padding: 6px 8px; text-align: right; color: #444;">Fee</th>
              <th style="padding: 6px 8px; text-align: right; color: #444;">Discount</th>
              <th style="padding: 6px 8px; text-align: right; color: #444;">Late Fee</th>
              <th style="padding: 6px 8px; text-align: right; color: #444;">Amount Paid</th>
            `}
          </tr>
        </thead>
        <tbody>
          ${isMisc ? lines.map((l, i) => `
            <tr key="${i}" style="border-bottom: 1px solid #EEE9F2;">
              <td style="padding: 7px 8px; font-weight: 700; color: #2C1930;">${l.head || r.miscHead || 'Miscellaneous Fee'}</td>
              <td style="padding: 7px 8px; color: #555;">${l.reason || r.remarks || '—'}</td>
              <td class="mono" style="padding: 7px 8px; text-align: right; font-weight: 700;">${RS0(l.net || r.total)}</td>
            </tr>
          `).join('') : lines.map((l) => `
            <tr style="border-bottom: 1px solid #EEE9F2;">
              <td style="padding: 6px 8px;"><b>${l.instNo}</b></td>
              <td style="padding: 6px 8px;">
                ${l.month || '—'}
                ${l.reason ? `<div style="font-size: 10px; color: #B01B5C;">${l.reason}</div>` : ''}
                ${l.balanceRemaining > 0 ? `<div style="font-size: 10px; color: #B3271E; font-weight: 600;">Bal: ${RS(l.balanceRemaining)}</div>` : ''}
              </td>
              <td class="mono" style="padding: 6px 8px; text-align: right;">${RS0(l.gross)}</td>
              <td class="mono" style="padding: 6px 8px; text-align: right; color: #B01B5C;">${l.discount ? `−${RS0(l.discount)}` : '—'}</td>
              <td class="mono" style="padding: 6px 8px; text-align: right;">${l.lateFee ? RS0(l.lateFee) : '—'}</td>
              <td class="mono" style="padding: 6px 8px; text-align: right; font-weight: 700;">${RS0(l.net)}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr style="border-top: 1.5px solid #2C1930; background: #FAF7FA;">
            <td colspan="${isMisc ? 2 : 5}" style="padding: 8px; text-align: right; font-weight: 800;">Total Received:</td>
            <td class="mono" style="padding: 8px; text-align: right; font-weight: 800; font-size: 14.5px; color: #B01B5C;">${RS(r.total)}</td>
          </tr>
        </tfoot>
      </table>

      <!-- Words & Signatures -->
      <div style="display: flex; justify-content: space-between; align-items: flex-end; font-size: 11px; color: #555; margin-top: 10px; padding-top: 6px; border-top: 1px dashed #D9D2E0;">
        <div style="max-width: 65%;">
          <div><b>Amount in words:</b> Rupees ${amountInWords || '—'} only</div>
          ${school.payeeName ? `<div style="margin-top: 4px; font-size: 10px;">Cheques in favour of "${school.payeeName}". ${school.refundNote || ''}</div>` : ''}
        </div>
        <div style="text-align: center;">
          <div style="height: 22px;"></div>
          <div style="border-top: 1px solid #777; padding-top: 3px; min-width: 140px; font-size: 11px; font-weight: 700;">
            ${r.collectedBy?.name ? `${r.collectedBy.name} · ` : ''}Authorised Signatory
          </div>
        </div>
      </div>

      <div style="margin-top: 10px; padding-top: 5px; border-top: 1px solid #EEE; display: flex; justify-content: space-between; font-size: 9.5px; color: #888;">
        <span>Official Computer-Generated Fee Receipt</span>
        <span>Pride & Joy School ERP · Twinscloud</span>
      </div>
    </div>
  `;
}

/**
 * Print fee receipt slip (single copy or duplicate copy)
 */
export function printReceiptSlip({ receipt, school, amountInWords, duplicate = false }) {
  if (!receipt) return;

  const bodyContent = duplicate
    ? `
      <div class="receipt-slip-container">
        ${renderReceiptHTML({ receipt, school, amountInWords, copyTitle: 'STUDENT COPY' })}
        <div class="cut-line"><span class="cut-label">✂ Cut along this line (Student Copy / School Office Copy)</span></div>
        ${renderReceiptHTML({ receipt, school, amountInWords, copyTitle: 'OFFICE / SCHOOL COPY' })}
      </div>
    `
    : `
      <div class="receipt-slip-container">
        ${renderReceiptHTML({ receipt, school, amountInWords, copyTitle: 'FEE SLIP' })}
      </div>
    `;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Receipt ${receipt.receiptNo} - ${receipt.student?.name || ''}</title>
        <style>${getSlipBaseStyles()}</style>
      </head>
      <body>
        ${bodyContent}
      </body>
    </html>
  `;

  printSlipHTML(html, `Receipt_${receipt.receiptNo}`);
}

/**
 * Print official student admission slip
 */
export function printAdmissionSlip({ student, school }) {
  if (!student) return;

  const schoolName = (school?.name || 'THE PRIDE AND JOY PRESCHOOL').toUpperCase();
  const address = school?.address || school?.branch || '';
  const session = school?.session ? `Session: ${school.session}` : '';
  const logo = school?.logo;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Admission Slip - ${student.admissionNo}</title>
        <style>
          ${getSlipBaseStyles()}
          .adm-slip {
            border: 2px solid #2C1930;
            border-radius: 8px;
            padding: 22px 28px;
            max-width: 800px;
            margin: 0 auto;
            page-break-inside: avoid;
          }
          .adm-header {
            display: flex;
            align-items: center;
            gap: 16px;
            border-bottom: 2px solid #B01B5C;
            padding-bottom: 12px;
          }
          .adm-title-banner {
            background: #2C1930;
            color: #fff;
            text-align: center;
            font-weight: 800;
            font-size: 13.5px;
            letter-spacing: 0.1em;
            padding: 6px 12px;
            margin: 14px -28px;
            text-transform: uppercase;
          }
          .info-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
            margin-top: 10px;
          }
          .info-table td {
            padding: 8px 10px;
            border-bottom: 1px solid #EEE;
          }
          .info-table td.lbl {
            color: #666;
            font-weight: 600;
            width: 25%;
            background: #FAF7FA;
          }
          .info-table td.val {
            font-weight: 700;
            color: #1E1826;
            width: 25%;
          }
          .adm-foot {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 40px;
            padding-top: 10px;
          }
          .sig-box {
            text-align: center;
            min-width: 160px;
            border-top: 1.5px solid #444;
            padding-top: 5px;
            font-size: 12px;
            font-weight: 700;
          }
        </style>
      </head>
      <body>
        <div class="adm-slip">
          <div class="adm-header">
            ${logo
              ? `<img src="${logo}" alt="" style="width: 54px; height: 54px; object-fit: contain;" />`
              : `<div style="width: 50px; height: 50px; border-radius: 8px; background: #B01B5C; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 20px;">
                  ${(school?.name || 'SC').slice(0, 2).toUpperCase()}
                </div>`}
            <div style="flex: 1;">
              <div style="font-size: 19px; font-weight: 900; letter-spacing: 0.02em; color: #2C1930;">${schoolName}</div>
              <div style="font-size: 12px; color: #555; margin-top: 3px;">${[address, school?.phone, school?.email].filter(Boolean).join(' · ')}</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 11px; font-weight: 700; color: #666;">${session}</div>
              <div class="mono" style="font-size: 16px; font-weight: 800; color: #B01B5C; margin-top: 4px;">${student.admissionNo}</div>
            </div>
          </div>

          <div class="adm-title-banner">
            STUDENT ADMISSION CONFIRMATION SLIP
          </div>

          <table class="info-table">
            <tr>
              <td class="lbl">Admission No:</td>
              <td class="val mono" style="color: #B01B5C; font-size: 14px;">${student.admissionNo}</td>
              <td class="lbl">Admission Date:</td>
              <td class="val">${fmtDate(student.admissionDate)}</td>
            </tr>
            <tr>
              <td class="lbl">Student Name:</td>
              <td class="val" style="font-size: 14px;">${student.name || '—'}</td>
              <td class="lbl">Gender:</td>
              <td class="val">${student.gender === 'F' ? 'Female' : student.gender === 'M' ? 'Male' : student.gender || '—'}</td>
            </tr>
            <tr>
              <td class="lbl">Class & Section:</td>
              <td class="val">${student.classId?.name || '—'} - ${student.section || 'A'}</td>
              <td class="lbl">Date of Birth:</td>
              <td class="val">${student.dob ? fmtDate(student.dob) : '—'}</td>
            </tr>
            <tr>
              <td class="lbl">Father's Name:</td>
              <td class="val">${student.father || '—'}</td>
              <td class="lbl">Mother's Name:</td>
              <td class="val">${student.mother || '—'}</td>
            </tr>
            <tr>
              <td class="lbl">Primary Mobile:</td>
              <td class="val mono">${student.phone || '—'}</td>
              <td class="lbl">Alternate Mobile:</td>
              <td class="val mono">${student.alternatePhone || '—'}</td>
            </tr>
            <tr>
              <td class="lbl">Address:</td>
              <td class="val" colspan="3">${student.address || '—'}</td>
            </tr>
            <tr>
              <td class="lbl">Blood Group:</td>
              <td class="val">${student.bloodGroup || '—'}</td>
              <td class="lbl">Child Aadhaar (Last 4):</td>
              <td class="val mono">${student.aadhaarLast4 ? `XXXX-XXXX-${student.aadhaarLast4}` : '—'}</td>
            </tr>
          </table>

          <div style="margin-top: 18px; padding: 10px 14px; background: #FBF9FC; border: 1px solid #E8E2EC; border-radius: 6px; font-size: 11.5px; color: #555;">
            <b>Important Notice:</b> Please keep this Admission Slip safe for future reference and ID verification. All school fees must be paid within the scheduled fee window each month.
          </div>

          <div class="adm-foot">
            <div class="sig-box">
              Parent / Guardian Signature
            </div>
            <div class="sig-box">
              Head / Principal Signature
            </div>
          </div>

          <div style="margin-top: 25px; text-align: center; font-size: 10px; color: #888;">
            Computer-Generated Admission Slip · Pride & Joy School CRM · Developed by Twinscloud Pvt. Ltd.
          </div>
        </div>
      </body>
    </html>
  `;

  printSlipHTML(html, `AdmissionSlip_${student.admissionNo}`);
}
