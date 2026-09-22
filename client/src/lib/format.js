export const RS = (n) => `₹${Number(Math.round(n || 0)).toLocaleString('en-IN')}`;
export const RS0 = (n) => Number(Math.round(n || 0)).toLocaleString('en-IN');

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const fmtDate = (d) => {
  if (!d) return '—';
  const x = new Date(d);
  return `${String(x.getDate()).padStart(2, '0')} ${MON[x.getMonth()]} ${x.getFullYear()}`;
};
export const toInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
export const monthKey = (d) => new Date(d).toISOString().slice(0, 7);
export const monthName = (key) => `${MON[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
export const initials = (n = '') => n.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase();

export const csvOf = (head, rows) => [
  head.join(','),
  ...rows.map((r) => r.map((c) => {
    const v = String(c ?? '');
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  }).join(',')),
].join('\n');

export function downloadCSV(filename, head, rows) {
  const blob = new Blob([csvOf(head, rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export const statusOf = (row) => {
  const bal = row.balance ?? Math.max(0, row.gross - row.discount + row.lateFee - row.paid);
  if (bal <= 0) return { k: 'paid', t: 'Paid' };
  if (row.paid > 0) return { k: 'part', t: 'Partial' };
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const due = new Date(row.dueDate);
  if (due < firstOfMonth) return { k: 'over', t: 'Overdue' };
  if (due.getMonth() === now.getMonth() && due.getFullYear() === now.getFullYear()) return { k: 'due', t: 'Due now' };
  return { k: 'up', t: 'Upcoming' };
};

/**
 * Formats a fee head or list of heads into a clean, concise string for receipt slips
 * e.g. "Tuition Fee" -> "Tuition"
 * "Tuition Fee, Admission Fee, Kit Charges" -> "Tuition, Admission, Kit"
 */
export function formatHeadsShort(headStr) {
  if (!headStr) return '';
  const rawList = Array.isArray(headStr)
    ? headStr
    : String(headStr).split(',').map((s) => s.trim()).filter(Boolean);

  if (!rawList.length) return '';

  const shortNames = rawList.map((h) => {
    const trimmed = h.trim();
    if (/^tuition(\s+fee)?$/i.test(trimmed)) return 'Tuition';
    if (/^admission(\s+fee)?$/i.test(trimmed)) return 'Admission';
    if (/^form\s*(\/|\&)\s*prospectus$/i.test(trimmed)) return 'Prospectus';
    if (/^kit(\s+charges)?$/i.test(trimmed)) return 'Kit';
    if (/^(half\s+)?annual(\s+fee)?$/i.test(trimmed)) return 'Annual';
    if (/^examination(\s+fee)?$/i.test(trimmed)) return 'Exam';
    if (/^transport(\s+fee)?$/i.test(trimmed)) return 'Transport';
    if (/^computer(\s+fee)?$/i.test(trimmed)) return 'Computer';
    if (/^activity(\s+charges)?$/i.test(trimmed)) return 'Activity';
    if (/^previous(\s+session)?\s+(balance|due)$/i.test(trimmed) || /^carry\s*forward$/i.test(trimmed)) return 'Prev. Due';

    const cleaned = trimmed.replace(/\s+(fee|charges|charge)$/i, '').trim();
    return cleaned || trimmed;
  });

  return [...new Set(shortNames)].join(', ');
}

