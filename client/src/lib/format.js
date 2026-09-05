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
