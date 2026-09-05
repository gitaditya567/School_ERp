import Counter from '../models/Counter.js';
import AuditLog from '../models/AuditLog.js';

export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthLabel = (d) => { const x = new Date(d); return `${MON[x.getMonth()]} ${x.getFullYear()}`; };
export const monthKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`; };
export const startOfMonth = (key) => new Date(`${key}-01T00:00:00.000Z`);
export const endOfMonth = (key) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
};
export const dayRange = (from, to) => {
  const q = {};
  if (from) q.$gte = new Date(`${from}T00:00:00.000Z`);
  if (to) q.$lte = new Date(`${to}T23:59:59.999Z`);
  return Object.keys(q).length ? q : null;
};

export const instTotal = (inst) => (inst.parts || []).reduce((s, p) => s + p.amount, 0);
export const balanceOf = (l) => Math.max(0, l.gross - l.discount + l.lateFee - l.paid);

/** Next value of a named sequence (receipts, admission numbers, vouchers). */
export const nextSeq = (key, session) => Counter.next(key, session);

export const pad = (n, w = 4) => String(n).padStart(w, '0');

export async function audit(req, action, entity, entityId, detail) {
  try {
    await AuditLog.create({
      user: req.user?._id, userName: req.user?.name,
      action, entity, entityId, detail,
    });
  } catch { /* auditing must never break the request */ }
}

/** Late fee owed on a ledger row if it is paid on `payDate`. */
export function lateFeeFor(ledger, payDate, school) {
  if (!school.lateFeeAmount) return 0;
  const due = new Date(ledger.dueDate);
  const cutoff = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), school.lateFeeFrom, 23, 59, 59));
  return new Date(payDate) > cutoff ? school.lateFeeAmount : 0;
}

export function amountInWords(n) {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven',
    'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (x) => (x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? ` ${a[x % 10]}` : ''));
  const three = (x) => (x > 99 ? `${a[Math.floor(x / 100)]} Hundred${x % 100 ? ` ${two(x % 100)}` : ''}` : two(x));
  let v = Math.round(n);
  if (!v) return 'Zero';
  let out = '';
  const cr = Math.floor(v / 10000000); v %= 10000000;
  const lk = Math.floor(v / 100000); v %= 100000;
  const th = Math.floor(v / 1000); v %= 1000;
  if (cr) out += `${three(cr)} Crore `;
  if (lk) out += `${three(lk)} Lakh `;
  if (th) out += `${three(th)} Thousand `;
  if (v) out += three(v);
  return out.trim();
}
