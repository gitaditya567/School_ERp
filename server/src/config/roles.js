/**
 * Single source of truth for what each role may see and do.
 * The client receives its own slice from /api/auth/me and the full
 * matrix from /api/roles — but every check is enforced here on the server.
 */
export const VIEWS = [
  'dashboard', 'admission', 'students', 'student', 'collect',
  'receipts', 'feemaster', 'concessions', 'daybook', 'reports', 'settings',
];

export const PERMISSIONS = [
  'collect', 'admit', 'editFeeMaster', 'approveDiscount',
  'addExpense', 'editSettings', 'export', 'cancelReceipt', 'manageUsers',
];

export const PERMISSION_LABELS = {
  collect: 'Collect fee',
  admit: 'Admission entry',
  editFeeMaster: 'Edit fee master',
  approveDiscount: 'Approve discount',
  addExpense: 'Expense voucher',
  editSettings: 'Settings & school profile',
  export: 'Export data',
  cancelReceipt: 'Cancel receipt',
  manageUsers: 'Manage users',
};

const full = Object.fromEntries(PERMISSIONS.map((p) => [p, true]));
const none = Object.fromEntries(PERMISSIONS.map((p) => [p, false]));

export const ROLES = {
  principal: {
    label: 'Principal / Admin',
    description: 'Full control of the school — approves every concession and owns the fee master.',
    views: VIEWS,
    can: { ...full },
    maxDiscount: Infinity,
  },
  director: {
    label: 'Director',
    description: 'Same authority as the Principal, with oversight of accounts and policy.',
    views: VIEWS,
    can: { ...full },
    maxDiscount: Infinity,
  },
  accountant: {
    label: 'Accountant',
    description: 'Collects fee and runs the books. Can waive up to the limit below; anything larger needs the Principal.',
    views: ['dashboard', 'students', 'student', 'collect', 'receipts', 'feemaster', 'concessions', 'daybook', 'reports'],
    can: { ...none, collect: true, addExpense: true, export: true },
    maxDiscount: 1000,
  },
  frontdesk: {
    label: 'Front Desk',
    description: 'Handles admissions and student records. Can see fee status but cannot take money.',
    views: ['dashboard', 'admission', 'students', 'student', 'receipts'],
    can: { ...none, admit: true },
    maxDiscount: 0,
  },
  teacher: {
    label: 'Class Teacher',
    description: 'Read-only view of her own class — student details and fee status, nothing else.',
    views: ['dashboard', 'students', 'student'],
    can: { ...none },
    maxDiscount: 0,
  },
};

export const ROLE_KEYS = Object.keys(ROLES);
export const roleOf = (key) => ROLES[key] || null;

/** Infinity does not survive JSON — send null and treat null as "no limit" on the client. */
export const publicRole = (key) => {
  const r = ROLES[key];
  if (!r) return null;
  return {
    key,
    label: r.label,
    description: r.description,
    views: r.views,
    can: r.can,
    maxDiscount: r.maxDiscount === Infinity ? null : r.maxDiscount,
  };
};
