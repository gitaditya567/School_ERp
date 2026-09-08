import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { cachedGet } from '../api/client';
import { useToast } from '../context/ToastContext';
import { Panel, Field, Input, Select, Loading, Empty } from '../components/ui';
import StudentPhotoPicker from '../components/StudentPhotoPicker';
import { RS } from '../lib/format';

const today = new Date().toISOString().slice(0, 10);
const REASONS = ['Sibling Concession', 'Staff Ward', 'Full Session Advance', 'Merit Scholarship',
  'Financial Hardship', 'Management Approval', 'Fee Card Correction'];

export default function NewAdmission() {
  const nav = useNavigate();
  const { toast, error: shout } = useToast();
  const [classes, setClasses] = useState(null);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [f, setF] = useState({
    admissionDate: today, name: '', dob: '', gender: 'F', classId: '', section: 'A', bloodGroup: 'O+', photo: '',
    father: '', mother: '', phone: '', alternatePhone: '', email: '', address: '', occupation: '',
    childAadhaar: '', fatherAadhaar: '', motherAadhaar: '', birthCertificateSubmitted: false,
    carryForward: 0, concessionReason: '', concessions: {},
  });

  useEffect(() => {
    document.title = 'New Admission';
    cachedGet('/classes').then((d) => {
      setClasses(d.classes);
      setF((v) => ({ ...v, classId: v.classId || d.classes[0]?.id || '' }));
    }).catch(shout);
  }, []);

  const klass = useMemo(() => classes?.find((c) => c.id === f.classId), [classes, f.classId]);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const digits = (k, len) => (e) => set(k, e.target.value.replace(/\D/g, '').slice(0, len));
  const letters = (k) => (e) => set(k, e.target.value.replace(/[^A-Za-z .'-]/g, ''));

  const validate = (s) => {
    const err = {};
    if (s === 1) {
      if (f.name.trim().length < 3) err.name = 'Enter a name of at least 3 characters.';
      if (!f.dob) err.dob = 'Date of birth is required.';
      else {
        const age = (Date.now() - new Date(f.dob)) / 31557600000;
        if (new Date(f.dob) > new Date()) err.dob = 'Date of birth cannot be in the future.';
        else if (age > 8) err.dob = 'Age is over 8 years — check the date or the class.';
        else if (age < 1.5) err.dob = 'The child must be at least 1 year 6 months old.';
      }
      if (!f.admissionDate) err.admissionDate = 'Admission date is required.';
      else if (new Date(f.admissionDate) > new Date()) err.admissionDate = 'Admission date cannot be in the future.';
      if (!f.classId) err.classId = 'Choose a class.';
      else if (klass && klass.plan.length === 0) err.classId = `${klass.name} has no fee plan yet — add its instalments in Fee Master first.`;
    }
    if (s === 2) {
      if (f.father.trim().length < 3) err.father = "Enter the father's or guardian's name.";
      if (!/^[6-9]\d{9}$/.test(f.phone)) err.phone = 'Enter a 10-digit mobile number starting with 6, 7, 8 or 9.';
      if (f.alternatePhone && !/^[6-9]\d{9}$/.test(f.alternatePhone)) err.alternatePhone = 'Enter a 10-digit mobile number starting with 6, 7, 8 or 9.';
      if (f.email && !/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(f.email)) err.email = 'Enter a valid email address.';
      if (f.address.trim().length < 8) err.address = 'Enter the address (at least 8 characters).';
      if (f.childAadhaar && !/^\d{12}$/.test(f.childAadhaar)) err.childAadhaar = 'Child Aadhaar must be exactly 12 digits.';
      if (f.fatherAadhaar && !/^\d{12}$/.test(f.fatherAadhaar)) err.fatherAadhaar = 'Father Aadhaar must be exactly 12 digits.';
      if (f.motherAadhaar && !/^\d{12}$/.test(f.motherAadhaar)) err.motherAadhaar = 'Mother Aadhaar must be exactly 12 digits.';
    }
    if (s === 3) {
      const given = Object.values(f.concessions).reduce((a, b) => a + (Number(b) || 0), 0);
      if (given > 0 && !f.concessionReason) err.concessionReason = 'Select a reason for the concession.';
      if (Number(f.carryForward) < 0) err.carryForward = 'Carry forward cannot be negative.';
    }
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const submit = async () => {
    if (!validate(3)) return;
    setBusy(true);
    try {
      const res = await api.post('/students', { ...f, carryForward: Number(f.carryForward) || 0 });
      toast(`${res.student.name} admitted · ${res.student.admissionNo}`);
      nav(`/students/${res.student._id}`);
    } catch (e) {
      shout(e);
      if (e.details) setErrors(e.details);
    } finally { setBusy(false); }
  };

  if (!classes) return <Loading />;
  if (!classes.length) {
    return (
      <Panel title="No class yet">
        <p className="muted" style={{ margin: '0 0 12px' }}>
          A student needs a class with a fee plan. Create one in Fee Master, then come back here.
        </p>
        <button type="button" className="btn btn-primary" onClick={() => nav('/fee-master')}>Open Fee Master</button>
      </Panel>
    );
  }

  const discountTotal = Object.values(f.concessions).reduce((a, b) => a + (Number(b) || 0), 0);

  return (
    <div className="split">
      <Panel bodyless title="New Admission" sub={`Step ${step} of 3`}
        actions={<div className="stepdots">{[1, 2, 3].map((n) => <i key={n} className={step >= n ? 'on' : ''} />)}</div>}>
        <div className="panel-body">
          {step === 1 && (
            <div>
              <div style={{ marginBottom: 18, borderBottom: '1px dashed var(--line)', paddingBottom: 16 }}>
                <StudentPhotoPicker value={f.photo} onChange={(v) => set('photo', v)} />
              </div>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))' }}>
                <Field label="Admission No."><Input readOnly value="Generated on save" /></Field>
                <Field label="Admission date *" error={errors.admissionDate}>
                  <Input type="date" max={today} value={f.admissionDate} onChange={(e) => set('admissionDate', e.target.value)} error={errors.admissionDate} />
                </Field>
                <Field label="Student full name *" error={errors.name} style={{ gridColumn: 'span 2' }}>
                  <Input maxLength={50} value={f.name} onChange={letters('name')} placeholder="e.g. Aarohi Srivastava" error={errors.name} />
                </Field>
                <Field label="Date of birth *" error={errors.dob}>
                  <Input type="date" max={today} value={f.dob} onChange={(e) => set('dob', e.target.value)} error={errors.dob} />
                </Field>
                <Field label="Gender *">
                  <Select value={f.gender} onChange={(e) => set('gender', e.target.value)}><option value="F">Girl</option><option value="M">Boy</option></Select>
                </Field>
                <Field label="Class *" error={errors.classId}>
                  <Select value={f.classId} onChange={(e) => set('classId', e.target.value)} error={errors.classId}>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}{c.plan.length ? '' : ' (no fee plan)'}</option>)}
                  </Select>
                </Field>
                <Field label="Section"><Select value={f.section} onChange={(e) => set('section', e.target.value)}><option>A</option><option>B</option></Select></Field>
                <Field label="Blood group">
                  <Select value={f.bloodGroup} onChange={(e) => set('bloodGroup', e.target.value)}>
                    {['A+', 'B+', 'O+', 'AB+', 'O-', 'A-', 'B-', 'AB-'].map((b) => <option key={b}>{b}</option>)}
                  </Select>
                </Field>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <div className="lbl" style={{ marginBottom: 10, color: 'var(--brand)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: 11 }}>
                  Parent / Guardian Details
                </div>
                <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
                  <Field label="Father / Guardian Name *" error={errors.father}>
                    <Input maxLength={50} value={f.father} onChange={letters('father')} placeholder="e.g. Rajesh Kumar" error={errors.father} />
                  </Field>
                  <Field label="Mother Name">
                    <Input maxLength={50} value={f.mother} onChange={letters('mother')} placeholder="e.g. Sunita Devi" />
                  </Field>
                  <Field label={`Father Aadhaar (12 digits)${f.fatherAadhaar ? ` · ${f.fatherAadhaar.length}/12` : ''}`} error={errors.fatherAadhaar}>
                    <Input className="input mono" inputMode="numeric" maxLength={12} value={f.fatherAadhaar}
                      onChange={digits('fatherAadhaar', 12)} placeholder="12-digit Aadhaar" error={errors.fatherAadhaar} />
                  </Field>
                  <Field label={`Mother Aadhaar (12 digits)${f.motherAadhaar ? ` · ${f.motherAadhaar.length}/12` : ''}`} error={errors.motherAadhaar}>
                    <Input className="input mono" inputMode="numeric" maxLength={12} value={f.motherAadhaar}
                      onChange={digits('motherAadhaar', 12)} placeholder="12-digit Aadhaar" error={errors.motherAadhaar} />
                  </Field>
                </div>
              </div>

              <div style={{ paddingTop: 14, borderTop: '1px dashed var(--line)' }}>
                <div className="lbl" style={{ marginBottom: 10, color: 'var(--brand)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: 11 }}>
                  Contact Information (2 Mobile Numbers)
                </div>
                <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
                  <Field label={`Primary Mobile * · ${f.phone.length}/10`} error={errors.phone}>
                    <Input className="input mono" inputMode="numeric" maxLength={10} value={f.phone}
                      onChange={digits('phone', 10)} placeholder="10 digits (6-9)" error={errors.phone} />
                  </Field>
                  <Field label={`Alternate Mobile · ${f.alternatePhone ? `${f.alternatePhone.length}/10` : 'Optional'}`} error={errors.alternatePhone}>
                    <Input className="input mono" inputMode="numeric" maxLength={10} value={f.alternatePhone}
                      onChange={digits('alternatePhone', 10)} placeholder="Optional 2nd mobile" error={errors.alternatePhone} />
                  </Field>
                  <Field label="Email" error={errors.email}>
                    <Input type="email" maxLength={60} value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="name@example.com" error={errors.email} />
                  </Field>
                  <Field label="Occupation">
                    <Input maxLength={40} value={f.occupation} onChange={(e) => set('occupation', e.target.value)} placeholder="e.g. Business / Service" />
                  </Field>
                  <Field label="Address *" error={errors.address} style={{ gridColumn: '1/-1' }}>
                    <textarea className={`input${errors.address ? ' invalid' : ''}`} rows={2} maxLength={160}
                      value={f.address} onChange={(e) => set('address', e.target.value)} placeholder="Full residential address" />
                  </Field>
                </div>
              </div>

              <div style={{ paddingTop: 14, borderTop: '1px dashed var(--line)' }}>
                <div className="lbl" style={{ marginBottom: 10, color: 'var(--brand)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: 11 }}>
                  Child Identification & Submitted Documents
                </div>
                <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', alignItems: 'center', gap: 14 }}>
                  <Field label={`Child Aadhaar (12 digits)${f.childAadhaar ? ` · ${f.childAadhaar.length}/12` : ''}`} error={errors.childAadhaar}>
                    <Input className="input mono" inputMode="numeric" maxLength={12} value={f.childAadhaar}
                      onChange={digits('childAadhaar', 12)} placeholder="12-digit Aadhaar" error={errors.childAadhaar} />
                  </Field>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 14px',
                      borderRadius: 'var(--r)',
                      background: f.birthCertificateSubmitted ? 'rgba(16, 185, 129, 0.08)' : 'var(--surface-2)',
                      border: `1px solid ${f.birthCertificateSubmitted ? '#10b981' : 'var(--line)'}`,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      marginTop: 4
                    }}
                    onClick={() => set('birthCertificateSubmitted', !f.birthCertificateSubmitted)}
                  >
                    <input
                      type="checkbox"
                      id="birthCertCheck"
                      checked={f.birthCertificateSubmitted}
                      onChange={(e) => set('birthCertificateSubmitted', e.target.checked)}
                      style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#10b981' }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <label htmlFor="birthCertCheck" style={{ cursor: 'pointer', flex: 1, margin: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: f.birthCertificateSubmitted ? '#10b981' : 'var(--text)' }}>
                        Child Birth Certificate Submitted
                      </div>
                      <div className="tiny muted" style={{ fontSize: 11 }}>
                        Tick if birth certificate copy has been received
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <>
              <div className="lbl" style={{ marginBottom: 10 }}>Fee plan — {klass?.name}</div>
              <div className="tbl-wrap" style={{ border: '1px solid var(--line)', borderRadius: 'var(--r)' }}>
                <table>
                  <thead><tr><th>Inst.</th><th>Due month</th><th>Particulars</th><th className="t-right">Amount</th><th className="t-right">One-time concession</th></tr></thead>
                  <tbody>
                    {(klass?.plan || []).map((p) => {
                      const total = p.parts.reduce((s, x) => s + x.amount, 0);
                      return (
                        <tr key={p.no}>
                          <td><b className="mono">{p.no}</b></td>
                          <td className="tiny nw">{p.month}</td>
                          <td className="tiny muted">{[...new Set(p.parts.map((x) => x.head?.name || 'Head'))].join(' + ')}</td>
                          <td className="num">{RS(total)}</td>
                          <td className="t-right">
                            <input className="input num" style={{ width: 100, padding: '4px 8px' }} inputMode="numeric"
                              value={f.concessions[p.no] || 0}
                              onChange={(e) => {
                                const v = Math.min(total, Number(e.target.value.replace(/\D/g, '')) || 0);
                                set('concessions', { ...f.concessions, [p.no]: v });
                              }} />
                          </td>
                        </tr>
                      );
                    })}
                    {!klass?.plan?.length && <tr><td colSpan={5}><Empty>This class has no instalments yet.</Empty></td></tr>}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--surface-2)' }}>
                      <td colSpan={3} style={{ fontWeight: 700 }}>Session total</td>
                      <td className="num" style={{ fontWeight: 700 }}>{RS(klass?.sessionTotal || 0)}</td>
                      <td className="num" style={{ fontWeight: 700, color: 'var(--brand)' }}>{RS(discountTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', marginTop: 14 }}>
                <Field label="Carry forward / previous balance" error={errors.carryForward}>
                  <Input inputMode="numeric" value={f.carryForward} onChange={digits('carryForward', 8)} error={errors.carryForward} />
                </Field>
                <Field label="Concession reason" error={errors.concessionReason} style={{ gridColumn: 'span 2' }}>
                  <Select value={f.concessionReason} onChange={(e) => set('concessionReason', e.target.value)} error={errors.concessionReason}>
                    <option value="">— select —</option>
                    {REASONS.map((r) => <option key={r}>{r}</option>)}
                  </Select>
                </Field>
              </div>
            </>
          )}
        </div>
        <div className="drawer-foot" style={{ position: 'static', borderTop: '1px solid var(--line)' }}>
          {step > 1 && <button type="button" className="btn" onClick={() => setStep(step - 1)}>← Back</button>}
          <div style={{ flex: 1 }} />
          <span className="tiny muted">
            {step === 3 ? 'On save, the fee ledger is created automatically' : 'Fields marked * are required'}
          </span>
          <button type="button" className="btn btn-primary" disabled={busy}
            onClick={() => { if (!validate(step)) return; if (step < 3) setStep(step + 1); else submit(); }}>
            {busy ? 'Saving…' : step === 3 ? 'Confirm admission' : 'Next →'}
          </button>
        </div>
      </Panel>

      <Panel title="How this works">
        <div className="tiny muted" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div><b style={{ color: 'var(--text)' }}>1. Admission No.</b><br />Issued by the server from a gap-free sequence — no duplicates.</div>
          <div><b style={{ color: 'var(--text)' }}>2. Fee ledger</b><br />The class plan is copied into one ledger row per instalment against this student.</div>
          <div><b style={{ color: 'var(--text)' }}>3. Concession</b><br />A separate discount per instalment, stored with its reason and approver.</div>
          <div><b style={{ color: 'var(--text)' }}>4. Carry forward</b><br />Any previous-session balance becomes a C/F row collected first.</div>
        </div>
      </Panel>
    </div>
  );
}
