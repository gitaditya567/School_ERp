import { Router } from 'express';
import { body, query } from 'express-validator';
import { protect, requirePerm, requireView } from '../middleware/auth.js';
import { checkValidation } from '../middleware/error.js';

import * as auth from '../controllers/authController.js';
import * as users from '../controllers/userController.js';
import * as master from '../controllers/masterController.js';
import * as students from '../controllers/studentController.js';
import * as fee from '../controllers/feeController.js';
import * as receipts from '../controllers/receiptController.js';
import * as expenses from '../controllers/expenseController.js';
import * as reports from '../controllers/reportController.js';
import * as dashboard from '../controllers/dashboardController.js';
import * as settings from '../controllers/settingsController.js';

const r = Router();
const V = checkValidation;

/* ------------------------------- auth ---------------------------------- */
r.get('/auth/status', auth.status);
r.post('/auth/bootstrap', [
  body('name').trim().isLength({ min: 3 }).withMessage('Enter your full name.'),
  body('email').isEmail().withMessage('Enter a valid email address.').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Use a password of at least 8 characters.'),
], V, auth.bootstrap);
r.post('/auth/login', [
  body('email').isEmail().withMessage('Enter a valid email address.'),
  body('password').notEmpty().withMessage('Enter your password.'),
], V, auth.login);

r.use(protect);                       // everything below needs a signed-in user

r.get('/auth/me', auth.me);
r.post('/auth/password', [
  body('currentPassword').notEmpty().withMessage('Enter your current password.'),
  body('newPassword').isLength({ min: 8 }).withMessage('The new password must be at least 8 characters.'),
], V, auth.changePassword);
r.get('/roles', auth.roleMatrix);

/* ------------------------------- users --------------------------------- */
r.get('/users', requirePerm('manageUsers'), users.list);
r.post('/users', requirePerm('manageUsers'), [
  body('name').trim().isLength({ min: 3 }).withMessage('Enter the full name.'),
  body('email').isEmail().withMessage('Enter a valid email address.').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Use a password of at least 8 characters.'),
  body('role').notEmpty().withMessage('Choose a role.'),
], V, users.create);
r.patch('/users/:id', requirePerm('manageUsers'), users.update);
r.delete('/users/:id', requirePerm('manageUsers'), users.remove);

/* ---------------------------- fee master ------------------------------- */
r.get('/fee-heads', master.listHeads);
r.post('/fee-heads', requirePerm('editFeeMaster'), [
  body('name').trim().isLength({ min: 3 }).withMessage('Enter a head name of at least 3 characters.'),
], V, master.createHead);
r.patch('/fee-heads/:id', requirePerm('editFeeMaster'), master.updateHead);
r.delete('/fee-heads/:id', requirePerm('editFeeMaster'), master.deleteHead);

r.get('/classes', master.listClasses);
r.get('/classes/:id', master.getClass);
r.post('/classes', requirePerm('editFeeMaster'), [
  body('name').trim().isLength({ min: 2 }).withMessage('Enter a class name of at least 2 characters.'),
  body('code').trim().isLength({ min: 2, max: 6 }).withMessage('Enter a short code, 2–6 characters.'),
], V, master.createClass);
r.patch('/classes/:id', requirePerm('editFeeMaster'), master.updateClass);
r.delete('/classes/:id', requirePerm('editFeeMaster'), master.deleteClass);

r.post('/classes/:id/instalments', requirePerm('editFeeMaster'), master.addInstalment);
r.patch('/classes/:id/instalments/:instId', requirePerm('editFeeMaster'), master.updateInstalment);
r.delete('/classes/:id/instalments/:instId', requirePerm('editFeeMaster'), master.deleteInstalment);
r.post('/classes/:id/copy-plan', requirePerm('editFeeMaster'), master.copyPlan);

/* ------------------------------ students ------------------------------- */
r.get('/students', requireView('students'), students.list);
r.get('/students/:id', requireView('student'), students.get);
r.post('/students', requirePerm('admit'), [
  body('name').trim().isLength({ min: 3 }).withMessage('Enter the student’s full name.')
    .matches(/^[A-Za-z][A-Za-z .'-]*$/).withMessage('The name may contain letters only.'),
  body('dob').isISO8601().withMessage('Enter a valid date of birth.'),
  body('classId').notEmpty().withMessage('Choose a class.'),
  body('admissionDate').isISO8601().withMessage('Enter a valid admission date.'),
  body('father').trim().isLength({ min: 3 }).withMessage('Enter the father’s or guardian’s name.'),
  body('phone').matches(/^[6-9]\d{9}$/).withMessage('Enter a 10-digit mobile number starting with 6, 7, 8 or 9.'),
  body('email').optional({ values: 'falsy' }).isEmail().withMessage('Enter a valid email address.'),
  body('aadhaarLast4').optional({ values: 'falsy' }).matches(/^\d{4}$/).withMessage('Aadhaar must be exactly 4 digits.'),
  body('carryForward').optional().isFloat({ min: 0 }).withMessage('Carry forward cannot be negative.'),
], V, students.create);
r.patch('/students/:id', requirePerm('admit'), students.update);
r.delete('/students/:id', requirePerm('admit'), students.remove);

/* -------------------------------- fee ---------------------------------- */
r.get('/fee/pending/:studentId', requirePerm('collect'), fee.pending);
r.post('/fee/collect', requirePerm('collect'), [
  body('studentId').notEmpty().withMessage('Choose a student.'),
  body('mode').notEmpty().withMessage('Choose a payment mode.'),
  body('lines').isArray({ min: 1 }).withMessage('Select at least one instalment.'),
], V, fee.collect);

/* ------------------------------ receipts ------------------------------- */
r.get('/receipts', requireView('receipts'), receipts.list);
r.get('/receipts/:id', requireView('receipts'), receipts.get);
r.post('/receipts/:id/cancel', requirePerm('cancelReceipt'), receipts.cancel);
r.get('/concessions', requireView('concessions'), receipts.concessions);

/* ------------------------------ day book ------------------------------- */
r.get('/expenses', requireView('daybook'), expenses.dayBook);
r.post('/expenses', requirePerm('addExpense'), [
  body('date').isISO8601().withMessage('Enter a valid date.'),
  body('head').notEmpty().withMessage('Choose an expense head.'),
  body('amount').isFloat({ gt: 0 }).withMessage('Enter an amount greater than zero.'),
], V, expenses.create);
r.delete('/expenses/:id', requirePerm('addExpense'), expenses.remove);

/* ------------------------------- reports ------------------------------- */
r.get('/reports/monthly-due', requireView('reports'), [
  query('month').optional().matches(/^\d{4}-\d{2}$/).withMessage('Month must look like 2026-09.'),
], V, reports.monthlyDue);
r.get('/reports/daily-collection', requireView('reports'), reports.dailyCollection);
r.get('/reports/carry-forward', requireView('reports'), reports.carryForward);

/* ----------------------------- dashboard ------------------------------- */
r.get('/dashboard', requireView('dashboard'), dashboard.summary);

/* ------------------------------ settings ------------------------------- */
r.get('/settings', settings.get);
r.patch('/settings', requirePerm('editSettings'), settings.update);
r.put('/settings/logo', requirePerm('editSettings'), settings.setLogo);
r.get('/audit', requirePerm('editSettings'), settings.auditTrail);

export default r;
