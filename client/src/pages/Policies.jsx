import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import api from '../api/client';

/**
 * Public policy pages (no login) — required by the payment gateway's compliance review.
 * School name and contact details come from Settings, so they stay in sync with receipts.
 */
const PAGES = [
  { path: '/privacy-policy', key: 'privacy', title: 'Privacy Policy' },
  { path: '/terms', key: 'terms', title: 'Terms & Conditions' },
  { path: '/refund-policy', key: 'refund', title: 'Refund & Cancellation Policy' },
  { path: '/contact', key: 'contact', title: 'Contact Us' },
];
export const POLICY_LINKS = PAGES;

const UPDATED = '19 October 2026';

export default function Policies({ page }) {
  const [school, setSchool] = useState(null);
  useEffect(() => {
    api.get('/auth/status').then((d) => setSchool(d.school || {})).catch(() => setSchool({}));
  }, []);
  const meta = PAGES.find((p) => p.key === page) || PAGES[0];
  useEffect(() => { document.title = `${meta.title}${school?.name ? ` · ${school.name}` : ''}`; }, [meta, school]);

  const s = {
    name: school?.name || 'The School',
    address: school?.address || school?.branch || '',
    phone: school?.phone || '',
    email: school?.email || '',
    refundNote: school?.refundNote || 'Fee once deposited is non-refundable.',
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <header style={{ background: 'var(--rail)', color: '#fff', padding: '18px 16px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {school?.logo && <img src={school.logo} alt="" style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 8, background: '#fff' }} />}
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{s.name}</div>
            {s.address && <div style={{ fontSize: 12.5, opacity: 0.8 }}>{s.address}</div>}
          </div>
          <Link to="/login" style={{ color: '#fff', fontSize: 13, opacity: 0.85 }}>Staff login →</Link>
        </div>
      </header>

      <nav style={{ borderBottom: '1px solid var(--line)', background: 'var(--surface)' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 16px', display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          {PAGES.map((p) => (
            <NavLink key={p.key} to={p.path} style={({ isActive }) => ({
              padding: '12px 0', fontSize: 13.5, textDecoration: 'none', fontWeight: isActive ? 700 : 500,
              color: isActive ? 'var(--brand)' : 'var(--text-2)', borderBottom: isActive ? '2px solid var(--brand)' : '2px solid transparent',
            })}>{p.title}</NavLink>
          ))}
        </div>
      </nav>

      <main style={{ maxWidth: 860, margin: '0 auto', padding: '28px 16px 48px', lineHeight: 1.65, fontSize: 14.5 }}>
        <h1 style={{ fontSize: 26, margin: '0 0 4px' }}>{meta.title}</h1>
        <p style={{ color: 'var(--text-3)', fontSize: 12.5, margin: '0 0 22px' }}>Last updated: {UPDATED}</p>
        {page === 'privacy' && <Privacy s={s} />}
        {page === 'terms' && <Terms s={s} />}
        {page === 'refund' && <Refund s={s} />}
        {page === 'contact' && <Contact s={s} />}
      </main>

      <footer style={{ borderTop: '1px solid var(--line)', padding: '16px', textAlign: 'center', fontSize: 12.5, color: 'var(--text-3)' }}>
        © {new Date().getFullYear()} {s.name} ·{' '}
        {PAGES.map((p, i) => <span key={p.key}>{i > 0 && ' · '}<Link to={p.path} style={{ color: 'var(--text-2)' }}>{p.title}</Link></span>)}
      </footer>
    </div>
  );
}

const H = ({ children }) => <h2 style={{ fontSize: 17, margin: '24px 0 6px' }}>{children}</h2>;

function ContactLine({ s }) {
  return (
    <>
      {s.address && <>{s.address}<br /></>}
      {s.phone && <>Phone: <a href={`tel:${s.phone.replace(/\s/g, '')}`}>{s.phone}</a><br /></>}
      {s.email && <>Email: <a href={`mailto:${s.email}`}>{s.email}</a></>}
    </>
  );
}

function Privacy({ s }) {
  return (
    <>
      <p>{s.name} (&quot;the School&quot;, &quot;we&quot;) respects the privacy of its students, parents and guardians. This policy explains what information we collect, how we use it and how we protect it, including when fees are paid online.</p>
      <H>Information we collect</H>
      <ul>
        <li>Student details: name, date of birth, class, admission number and other admission records.</li>
        <li>Parent / guardian details: name, mobile number, email address and residential address.</li>
        <li>Fee records: fee instalments, payments, receipts and transaction references.</li>
      </ul>
      <H>Online payments</H>
      <p>Online fee payments are processed by our payment gateway partner, NTT DATA Payment Services India (Atom). Card, UPI, net-banking and other payment details are entered on the payment gateway&apos;s secure page and are <b>not collected or stored by the School</b>. We receive only the transaction status, amount and transaction reference numbers needed to issue the fee receipt.</p>
      <H>How we use information</H>
      <ul>
        <li>To manage admissions, fee records and the student&apos;s academic records.</li>
        <li>To collect fees and issue receipts.</li>
        <li>To contact parents / guardians about fees, school notices and the student&apos;s progress.</li>
        <li>To comply with legal and regulatory requirements.</li>
      </ul>
      <H>Sharing of information</H>
      <p>We do not sell or rent personal information. Information is shared only with the payment gateway for processing payments, with service providers who host our systems under confidentiality obligations, or when required by law or a government authority.</p>
      <H>Security</H>
      <p>Access to student and fee records is limited to authorised school staff through individual logins with role-based permissions. Payment data is transmitted to the payment gateway over encrypted connections.</p>
      <H>Retention</H>
      <p>Records are kept for as long as the student is enrolled and thereafter as required for accounting, audit and legal purposes.</p>
      <H>Your choices</H>
      <p>Parents / guardians may ask to view or correct the information we hold by contacting the school office.</p>
      <H>Contact</H>
      <p><ContactLine s={s} /></p>
    </>
  );
}

function Terms({ s }) {
  return (
    <>
      <p>These terms apply to the payment of school fees to {s.name} (&quot;the School&quot;), including payments made online through our payment gateway. By paying fees online you agree to these terms.</p>
      <H>Services</H>
      <p>The School provides education services. Online payment is offered for tuition fees, admission and annual charges and other school fees (such as uniform, books, examination or activity charges) as notified by the School. All amounts are in Indian Rupees (INR).</p>
      <H>Fee amounts</H>
      <p>Fees are payable as per the fee structure and instalment schedule notified by the School for the academic session. A late fee may apply to payments made after the due date, as per the School&apos;s published rules. The amount shown at the time of payment is the amount payable.</p>
      <H>Payment</H>
      <ul>
        <li>Online payments are processed by NTT DATA Payment Services India (Atom) using credit / debit cards, net banking, UPI and other modes offered on the payment page.</li>
        <li>A payment is treated as received only after the payment gateway confirms it as successful. A fee receipt is then issued immediately.</li>
        <li>If a payment is pending with the bank, the receipt is issued automatically once the bank confirms it.</li>
        <li>The payment gateway or bank may charge a convenience fee for certain payment modes; this is shown on the payment page before you pay.</li>
      </ul>
      <H>Delivery of service</H>
      <p>No physical goods are sold. On a successful payment, the fee receipt is generated instantly and is available from the school office. There is no shipping or delivery involved.</p>
      <H>Refunds and cancellations</H>
      <p>Please see our <Link to="/refund-policy">Refund &amp; Cancellation Policy</Link>.</p>
      <H>Limitation</H>
      <p>The School is not responsible for delays or failures caused by banks, card networks, the payment gateway or internet connectivity. In case of any such issue, please contact the school office with the transaction reference.</p>
      <H>Governing law</H>
      <p>These terms are governed by the laws of India. Any dispute is subject to the jurisdiction of the courts at Lucknow, Uttar Pradesh.</p>
      <H>Contact</H>
      <p><ContactLine s={s} /></p>
    </>
  );
}

function Refund({ s }) {
  return (
    <>
      <H>Fee refunds</H>
      <p>{s.refundNote} Refunds are not given for withdrawal, absence or discontinuation of the student, except where the School&apos;s admission rules or a written decision of the School management provides otherwise.</p>
      <H>Duplicate or excess payments</H>
      <p>If the same fee is paid more than once, or an amount higher than the fee due is paid by mistake, the extra amount will be refunded after verification. Please write to the school office within 30 days of the payment with the receipt number and the transaction ID. Approved refunds are made to the <b>original payment method</b> (the same card, bank account or UPI ID) within <b>7–10 working days</b> of approval.</p>
      <H>Failed transactions</H>
      <p>If money is debited from your account but the payment fails or is not confirmed, no receipt is issued and the amount is automatically reversed by the bank / payment gateway to your account, normally within <b>5–7 working days</b>. If it is not reversed in this time, please contact the school office with the transaction details.</p>
      <H>Cancellation</H>
      <p>A payment cannot be cancelled once it is successful. You may cancel a payment on the payment page before completing it; no amount is charged in that case.</p>
      <H>Contact for refunds</H>
      <p><ContactLine s={s} /></p>
    </>
  );
}

function Contact({ s }) {
  return (
    <>
      <p>For fee payments, receipts, refunds or any other query, please contact the school office.</p>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, padding: '16px 18px', margin: '14px 0' }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{s.name}</div>
        <ContactLine s={s} />
      </div>
      <p>Office hours: Monday to Saturday, during school working hours. When writing about a payment, please mention the student&apos;s name, admission number, receipt number and the transaction ID.</p>
    </>
  );
}
