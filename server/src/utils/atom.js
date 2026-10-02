/**
 * Atom / NTT DATA Payment Services (NDPS) — AIPAY non-seamless checkout.
 *
 * Flow: server encrypts an AUTH request → NDPS returns an atomTokenId → the browser opens
 * atomcheckout.js with that token → after payment NDPS POSTs `encData` to our returnUrl
 * (and, when configured, server-to-server to the Callback URL). The Requery (transaction
 * status) API confirms any result we cannot verify by signature.
 *
 * Crypto per NDPS docs: AES-256-CBC, key = PBKDF2-HMAC-SHA512(key, salt=key, 65536, 256 bit),
 * IV = bytes 0..15, hex upper-case. Signatures are HMAC-SHA512, hex lower-case.
 */
import crypto from 'node:crypto';
import { ApiError } from './helpers.js';

const IV = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
const keyCache = new Map();

// URLs from the NDPS Transaction API (V6) and Requery API (V1.20) documents.
const UAT = {
  authUrl: 'https://paynetzuat.atomtech.in/otsv2/aipay/auth',
  cdnUrl: 'https://pgtest.atomtech.in/staticdata/ots/js/atomcheckout.js',
  statusUrl: 'https://paynetzuat.atomtech.in/otsv2/aipay/payment/status',
};
const PROD = {
  authUrl: 'https://payment.atomtech.in/otsv2/aipay/auth',
  cdnUrl: 'https://psa.atomtech.in/staticdata/ots/js/atomcheckout.js',
  statusUrl: 'https://payment.atomtech.in/otsv2/aipay/payment/status',
};

export function atomConfig() {
  const env = process.env.ATOM_ENV === 'prod' ? 'prod' : 'uat';
  const base = env === 'prod' ? PROD : UAT;
  return {
    env,
    merchId: process.env.ATOM_MERCH_ID || '',
    password: process.env.ATOM_PASSWORD || '',
    product: process.env.ATOM_PRODUCT_ID || 'NSE',
    custAccNo: process.env.ATOM_CUST_ACC_NO || '',
    apiSecretKey: process.env.ATOM_API_SECRET_KEY || '',
    reqEncKey: process.env.ATOM_REQ_ENC_KEY || '',
    reqSalt: process.env.ATOM_REQ_SALT || process.env.ATOM_REQ_ENC_KEY || '',
    resEncKey: process.env.ATOM_RES_ENC_KEY || '',
    resSalt: process.env.ATOM_RES_SALT || process.env.ATOM_RES_ENC_KEY || '',
    reqHashKey: process.env.ATOM_REQ_HASH_KEY || '',
    resHashKey: process.env.ATOM_RES_HASH_KEY || '',
    authUrl: process.env.ATOM_AUTH_URL || base.authUrl,
    cdnUrl: process.env.ATOM_CDN_URL || base.cdnUrl,
    statusUrl: process.env.ATOM_STATUS_URL || base.statusUrl,
  };
}

export function atomEnabled() {
  const c = atomConfig();
  return Boolean(c.authUrl && c.cdnUrl && c.merchId && c.password && c.reqEncKey && c.resEncKey && c.resHashKey);
}

/** NDPS status codes → our three outcomes (Requery API V1.20 "Response Codes"). */
const SUCCESS = new Set(['OTS0000', 'OTS0002']);
const PENDING = new Set(['OTS0201', 'OTS0301', 'OTS0351', 'OTS0551']);
export const outcomeOf = (code) => (SUCCESS.has(code) ? 'success' : PENDING.has(code) ? 'pending' : 'failed');

function deriveKey(pass, salt) {
  const k = `${pass}|${salt}`;
  if (!keyCache.has(k)) keyCache.set(k, crypto.pbkdf2Sync(pass, salt, 65536, 32, 'sha512'));
  return keyCache.get(k);
}

export function encrypt(text, c = atomConfig()) {
  const cipher = crypto.createCipheriv('aes-256-cbc', deriveKey(c.reqEncKey, c.reqSalt), IV);
  return (cipher.update(text, 'utf8', 'hex') + cipher.final('hex')).toUpperCase();
}

export function decrypt(hex, c = atomConfig()) {
  const decipher = crypto.createDecipheriv('aes-256-cbc', deriveKey(c.resEncKey, c.resSalt), IV);
  return Buffer.concat([decipher.update(Buffer.from(hex, 'hex')), decipher.final()]).toString('utf8');
}

const hmac = (key, text) => crypto.createHmac('sha512', key).update(text).digest('hex');

/** Headers for the otsv2 endpoints: Bearer base64(merchId:apiSecretKey). */
function authHeaders(c) {
  const h = { 'content-type': 'application/x-www-form-urlencoded', 'cache-control': 'no-cache' };
  if (c.apiSecretKey) h.authorization = `Bearer ${Buffer.from(`${c.merchId}:${c.apiSecretKey}`).toString('base64')}`;
  return h;
}

/** "2026-10-02 14:05:09" in Indian time, the format NDPS expects for merchTxnDate. */
export const istStamp = (d = new Date()) => new Date(new Date(d).getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');

/** Pulls `encData` out of an NDPS reply ("merchId=..&encData=.." or JSON) and decrypts it. */
function readEncrypted(text, c) {
  let encData = new URLSearchParams(text).get('encData');
  if (!encData) { try { encData = JSON.parse(text).encData; } catch { /* not JSON */ } }
  if (!encData) return null;
  return JSON.parse(decrypt(encData.trim(), c));
}

async function post(url, body, c, what) {
  try {
    const res = await fetch(url, { method: 'POST', headers: authHeaders(c), body, signal: AbortSignal.timeout(25000) });
    const text = await res.text();
    if (res.status === 401 || res.status === 403) {
      throw new ApiError(502, `Payment gateway refused the ${what} (${res.status}) — check ATOM_API_SECRET_KEY and the whitelisted IP.`);
    }
    return text;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    const code = e.cause?.code || e.name || e.message;
    // NDPS only accepts connections from whitelisted server IPs — a connect timeout almost always means this IP is not whitelisted.
    const hint = /CONNECT_TIMEOUT|ETIMEDOUT|TimeoutError|ECONNREFUSED/.test(code)
      ? ` The gateway (${new URL(url).host}) is not accepting this server's connection — get this server's public IP whitelisted with NDPS, or collect in cash.`
      : '';
    throw new ApiError(502, `Could not reach the payment gateway (${code}).${hint}`);
  }
}

/** AUTH API — asks NDPS for a checkout token. */
export async function createToken({ merchTxnId, amount, email, mobile, udf = [] }) {
  const c = atomConfig();
  const payload = {
    payInstrument: {
      headDetails: { version: 'OTSv1.1', api: 'AUTH', platform: 'FLASH' },
      merchDetails: { merchId: c.merchId, userId: '', password: c.password, merchTxnId, merchTxnDate: istStamp() },
      payDetails: {
        amount: Number(amount).toFixed(2), product: c.product, txnCurrency: 'INR',
        ...(c.custAccNo ? { custAccNo: c.custAccNo } : {}),
      },
      custDetails: { custEmail: email, custMobile: mobile },
      extras: Object.fromEntries([1, 2, 3, 4, 5].map((n) => [`udf${n}`, String(udf[n - 1] ?? '').slice(0, 45)])),
    },
  };

  const text = await post(c.authUrl, new URLSearchParams({ encData: encrypt(JSON.stringify(payload), c), merchId: c.merchId }), c, 'payment request');
  let data;
  try { data = readEncrypted(text, c); } catch {
    throw new ApiError(502, 'The payment gateway reply could not be decrypted — check the Atom response key.');
  }
  if (!data) throw new ApiError(502, `The payment gateway refused the request: ${text.slice(0, 200)}`);
  const status = data.responseDetails?.txnStatusCode;
  if (status !== 'OTS0000' || !data.atomTokenId) {
    throw new ApiError(502, `Payment gateway: ${data.responseDetails?.txnMessage || status || 'no token returned'} ${data.responseDetails?.txnDescription || ''}`.trim());
  }
  return { atomTokenId: String(data.atomTokenId), merchId: c.merchId, env: c.env, cdnUrl: c.cdnUrl };
}

/** Flattens a decrypted payInstrument into the fields we use. */
function summarise(pi, c) {
  const merchDetails = pi.merchDetails || {};
  const payDetails = pi.payDetails || {};
  const responseDetails = pi.responseDetails || {};
  const pmsd = pi.payModeSpecificData || {};
  const subChannel = Array.isArray(pmsd.subChannel) ? pmsd.subChannel[0] : (pmsd.subChannel ?? '');
  const bankTxnId = pmsd.bankDetails?.bankTxnId ?? '';
  const statusCode = String(responseDetails.statusCode ?? '');

  // Response signature: merchId + atomTxnId + merchTxnId + totalAmount + statusCode + subChannel + bankTxnId
  const given = String(payDetails.signature || '').toLowerCase();
  const expected = hmac(c.resHashKey, `${merchDetails.merchId}${payDetails.atomTxnId}${merchDetails.merchTxnId}`
    + `${Number(payDetails.totalAmount).toFixed(2)}${statusCode}${subChannel ?? ''}${bankTxnId ?? ''}`);
  const signatureOk = given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));

  return {
    signatureOk,
    merchId: String(merchDetails.merchId ?? ''),
    merchTxnId: String(merchDetails.merchTxnId ?? ''),
    atomTxnId: String(payDetails.atomTxnId ?? ''),
    amount: Number(payDetails.amount ?? payDetails.totalAmount), // fee amount, without any surcharge
    totalAmount: Number(payDetails.totalAmount ?? payDetails.amount),
    statusCode,
    outcome: outcomeOf(statusCode),
    message: String(responseDetails.description || responseDetails.message || ''),
    channel: String(subChannel || ''),
    bankTxnId: String(bankTxnId || ''),
  };
}

/** Decrypts a returnUrl / Callback API post and checks the signature (the Callback API sends it as null). */
export function parseResponse(encData) {
  const c = atomConfig();
  const data = JSON.parse(decrypt(String(encData).trim(), c));
  const pi = Array.isArray(data.payInstrument) ? data.payInstrument[0] : data.payInstrument;
  return summarise(pi || {}, c);
}

/**
 * Requery (Transaction Status) API — the authoritative answer for one merchTxnId.
 * Returns the same summary as parseResponse, or { outcome: 'pending', statusCode: 'OTS0401' } when NDPS has no record yet.
 */
export async function requery({ merchTxnId, amount, txnDate }) {
  const c = atomConfig();
  const amt = Number(amount).toFixed(2);
  const payload = {
    payInstrument: {
      merchDetails: { merchId: c.merchId, merchTxnId, merchTxnDate: istStamp(txnDate).slice(0, 10) },
      payDetails: {
        amount: amt,
        txnCurrency: 'INR',
        // merchId + password + merchTxnId + amount + txnCurrency + api, keyed with the request hash key
        signature: hmac(c.reqHashKey, `${c.merchId}${c.password}${merchTxnId}${amt}INRTXNVERIFICATION`),
      },
    },
  };
  const qs = new URLSearchParams({ merchId: c.merchId, encData: encrypt(JSON.stringify(payload), c) });
  const text = await post(`${c.statusUrl}?${qs}`, '', c, 'status check');
  let data;
  try { data = readEncrypted(text, c); } catch {
    throw new ApiError(502, 'The payment gateway status reply could not be decrypted.');
  }
  if (!data) throw new ApiError(502, `Payment gateway status check failed: ${text.slice(0, 200)}`);
  const list = Array.isArray(data.payInstrument) ? data.payInstrument : [data.payInstrument || {}];
  const pi = list.find((x) => String(x?.merchDetails?.merchTxnId) === merchTxnId) || list[0] || {};
  const s = summarise(pi, c);
  if (s.statusCode === 'OTS0401') return { ...s, outcome: 'nodata' };
  return { ...s, merchTxnId: s.merchTxnId || merchTxnId };
}
