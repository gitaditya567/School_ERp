import crypto from 'node:crypto';
import OnlinePayment from '../models/OnlinePayment.js';
import User from '../models/User.js';
import { asyncHandler, ApiError, audit } from '../utils/helpers.js';
import { roleOf } from '../config/roles.js';
import { atomConfig, atomEnabled, createToken, parseResponse, requery } from '../utils/atom.js';
import { prepareCollection, commitCollection, prepareMisc, commitMisc } from './feeController.js';

const today = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
const newTxnId = () => `PJ${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
const toPublic = (o) => ({
  id: o._id, merchTxnId: o.merchTxnId, kind: o.kind, amount: o.amount, status: o.status,
  atomTxnId: o.atomTxnId, bankTxnId: o.bankTxnId, channel: o.channel, message: o.message,
  receipt: o.receipt, student: o.student, createdAt: o.createdAt,
});

/** Where the browser should land after the gateway: APP_URL, else the origin the staff member is using. */
function appUrlFor(req) {
  const fromEnv = (process.env.APP_URL || '').replace(/\/+$/, '');
  if (fromEnv) return fromEnv;
  const origin = req.get('origin');
  if (origin) return origin.replace(/\/+$/, '');
  return `${req.get('x-forwarded-proto') || req.protocol}://${req.get('x-forwarded-host') || req.get('host')}`;
}

/** GET /api/payments/config — lets the screen know whether "Online" can be offered. */
export const config = asyncHandler(async (_req, res) => {
  res.json({ ok: true, enabled: atomEnabled() });
});

/**
 * POST /api/payments/online/start
 * body: { kind: 'regular'|'misc', ...same body as /fee/collect or /fee/collect-misc }
 * Validates the collection exactly like a cash receipt, then gets an Atom checkout token.
 */
export const start = asyncHandler(async (req, res) => {
  if (!atomEnabled()) throw new ApiError(503, 'Online payment is not configured yet. Collect in cash, or ask the admin to add the Atom keys.');
  const kind = req.body.kind === 'misc' ? 'misc' : 'regular';
  // Online money is always received today; the late fee and receipt date follow that.
  const request = { ...req.body, kind, date: today(), mode: 'Online', refNo: '' };

  const ctx = kind === 'misc' ? await prepareMisc(req, request) : await prepareCollection(req, request);
  const amount = ctx.total;
  if (!(amount > 0)) throw new ApiError(422, 'Nothing to pay online — the amount is zero. Use Cash to record a full concession.');

  const { student } = ctx;
  const order = await OnlinePayment.create({
    merchTxnId: newTxnId(),
    kind,
    student: student._id,
    amount,
    request,
    appUrl: appUrlFor(req),
    createdBy: req.user._id,
  });

  const mobile = String(student.phone || '').replace(/\D/g, '').slice(-10) || '9999999999';
  const email = student.email || process.env.ATOM_DEFAULT_EMAIL || 'fees@theprideandjoy.com';
  let token;
  try {
    token = await createToken({
      merchTxnId: order.merchTxnId,
      amount,
      email,
      mobile,
      udf: [student.admissionNo, student.name, kind],
    });
  } catch (e) {
    order.status = 'failed';
    order.message = e.message;
    await order.save();
    throw e;
  }
  order.atomTokenId = token.atomTokenId;
  await order.save();
  await audit(req, 'payment.online.start', 'OnlinePayment', order._id, { merchTxnId: order.merchTxnId, amount, student: student.name });

  res.status(201).json({
    ok: true,
    order: toPublic(order),
    checkout: {
      atomTokenId: token.atomTokenId,
      merchId: token.merchId,
      custEmail: email,
      custMobile: mobile,
      returnUrl: `${order.appUrl}/api/payments/atom/callback`,
      env: token.env,
      cdnUrl: token.cdnUrl,
    },
  });
});

/** Gateway says the money is in: turn the order into a receipt — exactly once. */
async function settle(order, resp) {
  const claimed = await OnlinePayment.findOneAndUpdate(
    { _id: order._id, status: { $in: ['pending', 'failed'] } },
    {
      status: 'processing', atomTxnId: resp.atomTxnId, bankTxnId: resp.bankTxnId,
      channel: resp.channel, statusCode: resp.statusCode, message: resp.message,
    },
    { new: true },
  );
  if (!claimed) return OnlinePayment.findById(order._id); // already settled by an earlier response

  try {
    const user = await User.findById(order.createdBy);
    if (!user) throw new ApiError(409, 'The staff account that started this payment no longer exists.');
    const req = {
      user,
      role: roleOf(user.role),
      scopeClass: user.role === 'teacher' && user.classId ? String(user.classId) : null,
    };
    const body = {
      ...order.request,
      mode: 'Online',
      refNo: [resp.atomTxnId, resp.bankTxnId].filter(Boolean).join(' / '),
      remarks: [order.request.remarks, resp.channel && `Paid via ${resp.channel}`].filter(Boolean).join(' · '),
    };
    const ctx = order.kind === 'misc' ? await prepareMisc(req, body) : await prepareCollection(req, body);
    if (Math.round(ctx.total * 100) !== Math.round(resp.amount * 100)) {
      throw new ApiError(409, `Amount changed since checkout (gateway ₹${resp.amount}, now due ₹${ctx.total}).`);
    }
    const receipt = order.kind === 'misc' ? await commitMisc(req, ctx, body) : await commitCollection(req, ctx, body);
    claimed.status = 'success';
    claimed.receipt = receipt._id;
    await claimed.save();
    return claimed;
  } catch (e) {
    // The money is with the school but the receipt could not be written — keep it visible for the office.
    claimed.status = 'unreconciled';
    claimed.message = `Payment received, receipt not created: ${e.message}`;
    await claimed.save();
    return claimed;
  }
}

/** Applies one gateway result (returnUrl, Callback API or Requery) to an order. */
async function apply(order, resp, source) {
  if (resp.merchId && resp.merchId !== atomConfig().merchId) throw new Error('Response is for a different merchant ID.');
  let next = order;
  if (resp.outcome === 'success') {
    next = await settle(order, resp);
  } else if (resp.outcome === 'failed' && ['pending', 'failed'].includes(order.status)) {
    next = await OnlinePayment.findOneAndUpdate(
      { _id: order._id, status: { $in: ['pending', 'failed'] } },
      { status: 'failed', atomTxnId: resp.atomTxnId, statusCode: resp.statusCode, message: resp.message || `Payment not completed (${resp.statusCode}).` },
      { new: true },
    ) || await OnlinePayment.findById(order._id);
  } else if (resp.outcome === 'pending' && order.status === 'pending') {
    next = await OnlinePayment.findByIdAndUpdate(order._id, {
      atomTxnId: resp.atomTxnId, statusCode: resp.statusCode,
      message: resp.message || 'Payment is pending with the bank — it will update automatically.',
    }, { new: true });
  }
  if (next.status !== order.status) {
    await audit({ user: { _id: order.createdBy, name: `Atom ${source}` } }, `payment.online.${next.status}`, 'OnlinePayment', order._id,
      { merchTxnId: order.merchTxnId, atomTxnId: resp.atomTxnId, statusCode: resp.statusCode, amount: resp.amount, source });
  }
  return next;
}

/** Asks NDPS for the real status of a pending order and applies it. */
async function reconcile(order) {
  const resp = await requery({ merchTxnId: order.merchTxnId, amount: order.amount, txnDate: order.createdAt });
  if (resp.outcome === 'nodata') {
    // NDPS has never seen a payment for it: the payer never got past the checkout.
    if (Date.now() - order.createdAt.getTime() > 2 * 3600 * 1000 && order.status === 'pending') {
      return apply(order, { ...resp, outcome: 'failed', message: 'No payment was made against this checkout.' }, 'requery');
    }
    return order;
  }
  return apply(order, resp, 'requery');
}

/** Trusts a decrypted response only if its signature matches; otherwise confirms it with the Requery API. */
async function verifiedResult(order, resp) {
  if (resp.signatureOk) return apply(order, resp, 'return');
  return reconcile(order);
}

/** GET /api/payments/online/:id[?refresh=1] — polled by the screen; refresh asks NDPS directly. */
export const status = asyncHandler(async (req, res) => {
  let order = await OnlinePayment.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Payment not found.');
  if (req.query.refresh && order.status === 'pending' && atomEnabled()) {
    try { order = await reconcile(order); } catch (e) { return res.json({ ok: true, order: toPublic(order), note: e.message }); }
  }
  res.json({ ok: true, order: toPublic(order) });
});

/** POST /api/payments/online/:id/cancel — staff closed the checkout without paying. */
export const cancel = asyncHandler(async (req, res) => {
  const order = await OnlinePayment.findOneAndUpdate(
    { _id: req.params.id, status: 'pending' },
    { status: 'failed', message: 'Cancelled at the counter before payment.' },
    { new: true },
  );
  if (order) await audit(req, 'payment.online.cancel', 'OnlinePayment', order._id, { merchTxnId: order.merchTxnId });
  res.json({ ok: true, order: order ? toPublic(order) : null });
});

/** GET /api/payments/online — recent online payments (for reconciliation). */
export const list = asyncHandler(async (req, res) => {
  const filter = req.query.status ? { status: req.query.status } : {};
  const rows = await OnlinePayment.find(filter).sort('-createdAt').limit(200)
    .populate('student', 'name admissionNo').populate('receipt', 'receiptNo');
  res.json({ ok: true, payments: rows.map((o) => ({ ...toPublic(o), student: o.student, receipt: o.receipt })) });
});

const readResponse = async (encData) => {
  if (!encData) throw new Error('No payment data was received from the gateway.');
  const resp = parseResponse(encData);
  const order = await OnlinePayment.findOne({ merchTxnId: resp.merchTxnId });
  if (!order) throw new Error(`Unknown transaction ${resp.merchTxnId}.`);
  return { resp, order };
};

/**
 * POST /api/payments/atom/callback  (no login — NDPS posts the payer's browser here; this is the returnUrl)
 * Records the result, then sends the browser back to the Collect Fee screen.
 */
export const callback = async (req, res) => {
  let order = null;
  let note = '';
  try {
    const r = await readResponse(req.body?.encData);
    order = r.order;
    order = await verifiedResult(order, r.resp);
  } catch (e) {
    note = e.message;
    console.error('[atom return]', e.message);
  }

  const base = order?.appUrl || (process.env.APP_URL || '').replace(/\/+$/, '');
  const params = new URLSearchParams();
  if (order) {
    params.set('student', String(order.student));
    if (order.kind === 'misc') params.set('mode', 'misc');
    params.set('payment', String(order._id));
  } else {
    params.set('payerror', note || 'Payment response could not be read.');
  }
  const target = `${base}/collect?${params}`;
  const nonce = crypto.randomBytes(12).toString('base64');
  // Works whether NDPS loads the returnUrl in the top window or inside its checkout frame.
  res.set('Content-Security-Policy', `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'`);
  res.type('html').send(`<!doctype html><meta charset="utf-8"><title>Payment</title>
<p style="font:15px system-ui;padding:24px">Returning to the school ERP… <a href="${target.replace(/"/g, '&quot;')}" target="_top">Continue</a></p>
<script nonce="${nonce}">window.top.location.replace(${JSON.stringify(target).replace(/</g, '\\u003c')});</script>`);
};

/**
 * POST /api/payments/atom/notify  (no login — NDPS Callback API, server-to-server)
 * Fires on success/failure, including late bank confirmations (T+1). The Callback API sends
 * no signature, so the result is confirmed with the Requery API before it is applied.
 */
export const notify = async (req, res) => {
  try {
    const { order } = await readResponse(req.body?.encData);
    await reconcile(order);
  } catch (e) {
    console.error('[atom notify]', e.message);
  }
  res.type('text').send('OK');
};

/** Every few minutes, ask NDPS about checkouts still pending (browser closed, bank delay…). */
export function startReconciler(everyMs = 5 * 60 * 1000) {
  if (!atomEnabled()) return null;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const now = Date.now();
      const due = await OnlinePayment.find({
        status: 'pending',
        createdAt: { $lte: new Date(now - 3 * 60 * 1000), $gte: new Date(now - 29 * 24 * 3600 * 1000) }, // Requery works for 30 days
      }).limit(50);
      for (const order of due) {
        try { await reconcile(order); } catch (e) { console.error('[atom reconcile]', order.merchTxnId, e.message); }
      }
    } finally { running = false; }
  };
  const id = setInterval(tick, everyMs);
  id.unref?.();
  return id;
}
