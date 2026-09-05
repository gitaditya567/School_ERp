# School ERP — MERN

Admission, instalment-wise fee collection, receipts, concessions, day book, reports and role-based
access for a school. **MongoDB + Express + React + Node.** No demo or hard-coded data anywhere:
the database starts empty and every class, student and receipt is created through the app.

---

## 1. What you need

| | |
|---|---|
| Node.js | 18 or newer (tested on 22) |
| MongoDB | 6 or newer — local `mongod`, Docker, or a free MongoDB Atlas cluster |
| npm | comes with Node |

## 2. Install

```bash
npm run install:all          # root + server + client
cp server/.env.example server/.env
```

Open `server/.env` and set at least:

```ini
MONGO_URI=mongodb://127.0.0.1:27017/school_erp
JWT_SECRET=<a long random string>
SEED_ADMIN_EMAIL=principal@yourschool.in
SEED_ADMIN_PASSWORD=<a strong password>
```

## 3. Create the first account

```bash
npm run seed
```

This writes **only** two things:

* the first **Principal** account (from the `SEED_ADMIN_*` values), and
* the seven standard fee heads — Tuition, Admission, Form/Prospectus, Kit, Half Annual, Late Fee,
  Previous Session Balance.

No classes, no students, no receipts. If you skip the seed entirely, the app detects an empty
database and shows a **first-run screen** that creates the Principal account for you.

## 4. Run

```bash
npm run dev
```

* API → <http://localhost:5000>
* App → <http://localhost:5173>

Sign in with the Principal account. Then, in order:

1. **Fee Master** → create a class, add its instalments (fee head + amount per line).
2. **New Admission** → admit a student; the fee ledger is generated from that class plan.
3. **Collect Fee** → select instalments, apply any concession, generate the receipt.
4. **Settings → Users** → invite the Accountant, Front Desk and Class Teacher accounts.

## 5. Test

Both suites are written against a **running** stack, so start the app first.

```bash
npm run dev                  # terminal 1
npm test                     # terminal 2 — 129 API / business-logic checks
npm run build && npm start   # serve the built app on :5000
npm run test:ui              # 30 browser checks (needs `npx playwright install chromium` once)
```

> `npm test` **wipes the database it points at.** Never run it against production — point
> `MONGO_URI` at a scratch database first.

Latest run: **129 / 129 API checks, 30 / 30 browser checks.** Screenshots of every screen the
browser test walks through are in `test/screenshots/`.

## 6. Deploy

```bash
npm run build                # builds client/dist
NODE_ENV=production npm start
```

In production the API serves `client/dist`, so one process and one port is enough. Set
`MONGO_URI`, `JWT_SECRET` and `NODE_ENV=production` in the environment, and put the app behind
HTTPS.

---

## Modules

| Module | What it does |
|---|---|
| **Dashboard** | Collection vs expense chart, session progress, instalment status, class-wise collection, overdue list |
| **Admission** | 3-step admission wizard with full validation, auto admission number, student directory, student ledger |
| **Fee & Accounts** | Fee Master (classes, instalments, fee heads), Collect Fee with per-instalment concession, receipt register, concession register, day book |
| **Reports** | Monthly Due, Daily Collection, Carry Forward — filterable and exportable as CSV |
| **Settings** | School profile, logo upload, receipt series and fee rules, users, role permission matrix, audit trail |

## Roles

Enforced on the server for every request; the UI only mirrors it.

| Action | Principal | Director | Accountant | Front Desk | Class Teacher |
|---|:--:|:--:|:--:|:--:|:--:|
| Collect fee | ✓ | ✓ | ✓ | — | — |
| Admission entry | ✓ | ✓ | — | ✓ | — |
| Edit fee master | ✓ | ✓ | — | — | — |
| Approve discount | ✓ | ✓ | — | — | — |
| Expense voucher | ✓ | ✓ | ✓ | — | — |
| Settings & users | ✓ | ✓ | — | — | — |
| Export data | ✓ | ✓ | ✓ | — | — |
| Cancel receipt | ✓ | ✓ | — | — | — |
| **Concession limit** | none | none | ₹1,000 | ₹0 | ₹0 |
| **Modules visible** | 11 | 11 | 10 | 5 | 3 |

A Class Teacher is bound to one class: her student list, dashboard figures and every student
lookup are filtered to it, and opening another class's student returns 403.

Edit `server/src/config/roles.js` to change any of this — it is the single source of truth and the
client reads its own slice from `/api/auth/me`.

## Rules the server enforces

* **Receipt numbers** come from an atomic counter — gap-free, never reused, even after a
  cancellation.
* **A receipt is never edited**, only cancelled with a reason; cancelling reverses the ledger,
  deletes the linked concession rows and keeps the number burnt.
* **A concession needs a reason and an approver**, and is refused above the role's limit.
* **An instalment that has been collected** cannot be edited or deleted.
* **A class with students** cannot be deleted; **a fee head in use** cannot be deleted.
* **Editing a fee plan** re-prices every *unpaid* ledger row in that class immediately and leaves
  paid rows and issued receipts untouched.
* **Every money action** is written to `audit_log`.

## Project layout

```
pride-joy-erp/
├─ server/
│  ├─ src/
│  │  ├─ config/       roles.js (permission matrix), db.js (connection + transactions)
│  │  ├─ models/       School User FeeHead Class Student Ledger Receipt Concession Expense Counter AuditLog
│  │  ├─ middleware/   auth.js (JWT, requirePerm, class scope), error.js (validation + error shape)
│  │  ├─ services/     ledger.js (create and re-sync student ledgers)
│  │  ├─ controllers/  auth user master student fee receipt expense report dashboard settings
│  │  ├─ routes/       index.js (every endpoint with its validators and guards)
│  │  ├─ seed.js       first Principal + standard fee heads
│  │  └─ index.js      express app
│  └─ test/e2e.js      129 API / business-logic checks
├─ client/
│  └─ src/
│     ├─ api/client.js       axios instance, token header, 401 handling
│     ├─ context/            AuthContext (user, role, permissions), ToastContext
│     ├─ components/         Layout (sidebar + topbar), ui.jsx (Panel, Drawer, Field, Chip…), Charts.jsx
│     ├─ pages/              Login Dashboard Students StudentProfile NewAdmission CollectFee
│     │                      Receipts ReceiptView FeeMaster Concessions DayBook Reports Settings
│     ├─ lib/format.js       ₹ formatting, dates, CSV export, ledger status
│     └─ styles.css          design tokens, light + dark themes, app shell
└─ test/ui.mjs               30 browser checks (Playwright)
```

## API

All routes are under `/api`. Everything except the first four needs
`Authorization: Bearer <token>`.

| Method | Path | Guard |
|---|---|---|
| GET | `/auth/status` | public — reports whether first-run setup is needed |
| POST | `/auth/bootstrap` | public, only while no user exists |
| POST | `/auth/login` | public |
| GET | `/health` | public |
| GET | `/auth/me` · POST `/auth/password` · GET `/roles` | any signed-in user |
| GET/POST/PATCH/DELETE | `/users` | `manageUsers` |
| GET | `/fee-heads` · `/classes` · `/classes/:id` | any signed-in user |
| POST/PATCH/DELETE | `/fee-heads/:id` · `/classes/:id` | `editFeeMaster` |
| POST/PATCH/DELETE | `/classes/:id/instalments/:instId` · POST `/classes/:id/copy-plan` | `editFeeMaster` |
| GET | `/students` · `/students/:id` | view `students` / `student` (class-scoped) |
| POST/PATCH/DELETE | `/students/:id` | `admit` |
| GET | `/fee/pending/:studentId` · POST `/fee/collect` | `collect` |
| GET | `/receipts` · `/receipts/:id` · `/concessions` | view `receipts` / `concessions` |
| POST | `/receipts/:id/cancel` | `cancelReceipt` |
| GET | `/expenses` · POST/DELETE `/expenses/:id` | view `daybook` / `addExpense` |
| GET | `/reports/monthly-due` · `/reports/daily-collection` · `/reports/carry-forward` | view `reports` |
| GET | `/dashboard` | view `dashboard` |
| GET | `/settings` | any signed-in user |
| PATCH | `/settings` · PUT `/settings/logo` · GET `/audit` | `editSettings` |

Errors always come back as `{ ok: false, message, details? }` — `message` is safe to show to the
user, `details` maps field names to their messages for form highlighting.

## Notes

* **Transactions.** Fee collection and cancellation run inside a MongoDB transaction when the
  deployment supports one (replica set or Atlas) and fall back to sequential writes on a
  standalone `mongod`. Set `DISABLE_TRANSACTIONS=1` to force the fallback.
* **The logo** is stored as a data URL on the school document, capped at ~200 KB; the browser
  resizes anything larger to 256 px before upload.
* **Dark mode** follows the operating system and can be toggled from the sidebar.
