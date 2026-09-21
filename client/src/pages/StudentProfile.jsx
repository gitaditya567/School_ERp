import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Panel, Chip, Loading, ErrorBox, Empty, Bar, Drawer, Field, Input, Confirm } from '../components/ui';
import StudentPhotoPicker from '../components/StudentPhotoPicker';
import StudentDocumentModal from '../components/StudentDocumentModal';
import ReceiptView from './ReceiptView';
import { RS, fmtDate, initials, statusOf } from '../lib/format';
import { printAdmissionSlip } from '../lib/printSlip';

export default function StudentProfile() {
  const { id } = useParams();
  const nav = useNavigate();
  const { can, school } = useAuth();
  const { toast, error: shout } = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [receiptId, setReceiptId] = useState(null);
  const [editingPhoto, setEditingPhoto] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editErrors, setEditErrors] = useState({});
  const [savingDetails, setSavingDetails] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);

  const load = () => { setError(null); api.get(`/students/${id}`).then(setData).catch(setError); };
  useEffect(() => { document.title = 'Student Ledger'; load(); }, [id]);

  if (error) return <ErrorBox error={error} onRetry={load} />;
  if (!data) return <Loading />;
  const { student: s, ledger, receipts, totals } = data;

  const updatePhoto = async (newPhoto) => {
    try {
      await api.patch(`/students/${s._id}`, { photo: newPhoto });
      toast('Student photo updated');
      load();
    } catch (e) {
      shout(e);
    }
  };

  const startEdit = () => {
    setEditForm({
      name: s.name || '',
      dob: s.dob ? s.dob.slice(0, 10) : '',
      bloodGroup: s.bloodGroup || '',
      father: s.father || '',
      mother: s.mother || '',
      phone: s.phone || '',
      alternatePhone: s.alternatePhone || '',
      email: s.email || '',
      address: s.address || '',
      occupation: s.occupation || '',
      childAadhaar: s.childAadhaar || '',
      fatherAadhaar: s.fatherAadhaar || '',
      motherAadhaar: s.motherAadhaar || '',
      birthCertificateSubmitted: Boolean(s.birthCertificateSubmitted),
      fatherAadhaarSubmitted: Boolean(s.fatherAadhaarSubmitted),
      motherAadhaarSubmitted: Boolean(s.motherAadhaarSubmitted),
    });
    setEditErrors({});
    setEditingDetails(true);
  };

  const saveDetails = async () => {
    const err = {};
    if (!editForm.name.trim()) err.name = 'Name is required.';
    if (!editForm.father.trim()) err.father = 'Father name is required.';
    if (!/^[6-9]\d{9}$/.test(editForm.phone)) err.phone = 'Enter a valid 10-digit mobile number.';
    if (editForm.alternatePhone && !/^[6-9]\d{9}$/.test(editForm.alternatePhone)) {
      err.alternatePhone = 'Enter a valid 10-digit mobile number.';
    }
    if (editForm.childAadhaar && !/^\d{12}$/.test(editForm.childAadhaar)) {
      err.childAadhaar = 'Child Aadhaar must be exactly 12 digits.';
    }
    if (editForm.fatherAadhaar && !/^\d{12}$/.test(editForm.fatherAadhaar)) {
      err.fatherAadhaar = 'Father Aadhaar must be exactly 12 digits.';
    }
    if (editForm.motherAadhaar && !/^\d{12}$/.test(editForm.motherAadhaar)) {
      err.motherAadhaar = 'Mother Aadhaar must be exactly 12 digits.';
    }

    if (Object.keys(err).length > 0) {
      setEditErrors(err);
      return;
    }

    setSavingDetails(true);
    try {
      await api.patch(`/students/${s._id}`, editForm);
      toast('Student details updated');
      setEditingDetails(false);
      load();
    } catch (e) {
      shout(e);
      if (e.details) setEditErrors(e.details);
    } finally {
      setSavingDetails(false);
    }
  };

  const deleteStudent = async () => {
    setDeleting(true);
    try {
      await api.delete(`/students/${s._id}?force=true`);
      toast(`${s.name} deleted successfully`);
      nav('/students');
    } catch (e) {
      shout(e);
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const digits = (k, len) => (e) => setEditForm((p) => ({ ...p, [k]: e.target.value.replace(/\D/g, '').slice(0, len) }));

  return (
    <div className="stack">
      <Panel bodyless>
        <div className="panel-head" style={{ alignItems: 'flex-start' }}>
          <div style={{ position: 'relative' }}>
            {s.photo ? (
              <img
                src={s.photo}
                alt={s.name}
                style={{ width: 52, height: 52, borderRadius: 12, objectFit: 'cover', border: '1px solid var(--brand-line)', cursor: can('admit') ? 'pointer' : 'default' }}
                onClick={() => can('admit') && setEditingPhoto(!editingPhoto)}
                title="Click to edit photo"
              />
            ) : (
              <div
                className="avatar"
                style={{ width: 52, height: 52, borderRadius: 12, background: 'var(--brand-soft)', color: 'var(--brand-ink)', fontSize: 18, border: '1px solid var(--brand-line)', cursor: can('admit') ? 'pointer' : 'default' }}
                onClick={() => can('admit') && setEditingPhoto(!editingPhoto)}
                title="Click to edit photo"
              >
                {initials(s.name)}
              </div>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 19 }}>{s.name}</h3>
            <div className="sub">
              {s.admissionNo} · {s.classId?.name}-{s.section} · Admitted {fmtDate(s.admissionDate)} <Chip tone={s.status === 'Active' ? 'paid' : 'up'}>{s.status}</Chip>
            </div>
            {editingPhoto && (
              <div style={{ marginTop: 10 }}>
                <StudentPhotoPicker value={s.photo || ''} onChange={updatePhoto} label="Update Student Photo" />
              </div>
            )}
          </div>
          <button type="button" className="btn btn-sm" onClick={() => nav('/students')}>← Directory</button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => printAdmissionSlip({ student: s, school })}
            title="Print official admission confirmation slip"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
          >
            <span>📄</span> Print Admission Slip
          </button>
          {can('admit') && (
            <>
              <button type="button" className="btn btn-sm" onClick={startEdit}>Edit Details</button>
              <button
                type="button"
                className="btn btn-sm"
                style={{ color: 'var(--crit)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                onClick={() => setConfirmDelete(true)}
              >
                Delete Student
              </button>
            </>
          )}
          {can('collect')
            ? <button type="button" className="btn btn-primary btn-sm" onClick={() => nav(`/collect?student=${s._id}`)}>Collect Fee</button>
            : <span className="locked-note">View only</span>}
        </div>
        <div className="panel-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 20 }}>
          <dl className="def">
            <dt>Father</dt>
            <dd>
              {s.father}
              {s.fatherAadhaar ? <div className="mono tiny muted">Aadhaar: {s.fatherAadhaar}</div> : null}
            </dd>
            <dt>Mother</dt>
            <dd>
              {s.mother || '—'}
              {s.motherAadhaar ? <div className="mono tiny muted">Aadhaar: {s.motherAadhaar}</div> : null}
            </dd>
            <dt>Primary Mobile</dt><dd className="mono">{s.phone}</dd>
            <dt>Alternate Mobile</dt><dd className="mono">{s.alternatePhone || '—'}</dd>
            <dt>Email</dt><dd className="tiny">{s.email || '—'}</dd>
          </dl>
          <dl className="def">
            <dt>Date of birth</dt><dd>{fmtDate(s.dob)}</dd>
            <dt>Blood group</dt><dd>{s.bloodGroup || '—'}</dd>
            <dt>Child Aadhaar</dt>
            <dd className="mono">
              {s.childAadhaar || (s.aadhaarLast4 ? `•••• ${s.aadhaarLast4}` : '—')}
            </dd>
            <dt>Documents</dt>
            <dd>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <span title="Child Birth Certificate">
                  {s.birthCertificateSubmitted ? <Chip tone="paid">Birth Cert ✓</Chip> : <Chip tone="due">Birth Cert ✗</Chip>}
                </span>
                <span title="Father Aadhaar">
                  {s.fatherAadhaarSubmitted ? <Chip tone="paid">Father Aadhaar ✓</Chip> : <Chip tone="due">Father Aadhaar ✗</Chip>}
                </span>
                <span title="Mother Aadhaar">
                  {s.motherAadhaarSubmitted ? <Chip tone="paid">Mother Aadhaar ✓</Chip> : <Chip tone="due">Mother Aadhaar ✗</Chip>}
                </span>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ padding: '2px 8px', fontSize: 11, cursor: 'pointer', borderColor: 'var(--brand-line)', color: 'var(--brand)' }}
                  onClick={() => setShowDocModal(true)}
                  title="Upload or view student & parent documents"
                >
                  📁 Manage / Upload
                </button>
              </div>
            </dd>
            <dt>Address</dt><dd>{s.address || '—'}</dd>
          </dl>
          <dl className="def">
            <dt>Gross fee</dt><dd className="mono">{RS(totals.gross)}</dd>
            <dt>Concession</dt><dd className="mono" style={{ color: 'var(--brand)' }}>− {RS(totals.discount)}</dd>
            <dt>Late fee</dt><dd className="mono">{RS(totals.lateFee)}</dd>
            <dt>Net payable</dt><dd className="mono" style={{ fontWeight: 700 }}>{RS(totals.payable)}</dd>
          </dl>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
            <div><div className="lbl">Collected</div><div className="mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--good)' }}>{RS(totals.paid)}</div></div>
            <div><div className="lbl">Outstanding</div><div className="mono" style={{ fontSize: 20, fontWeight: 700, color: totals.outstanding ? 'var(--warn)' : 'var(--text-3)' }}>{RS(totals.outstanding)}</div></div>
            <Bar pct={totals.payable ? (totals.paid / totals.payable) * 100 : 0} />
          </div>
        </div>
      </Panel>

      <div className="split">
        <Panel bodyless title="Fee Ledger" sub={`Instalment wise · ${s.classId?.name} plan`}>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr><th>Inst.</th><th>Due month</th><th className="t-right">Gross</th><th className="t-right">Discount</th>
                  <th className="t-right">Late</th><th className="t-right">Paid</th><th className="t-right">Balance</th><th>Status</th></tr>
              </thead>
              <tbody>
                {ledger.length === 0 && <tr><td colSpan={8}><Empty>No ledger rows.</Empty></td></tr>}
                {ledger.map((l) => {
                  const st = statusOf(l);
                  return (
                    <tr key={l._id}>
                      <td><b className="mono">{l.instNo}</b></td>
                      <td className="tiny nw">{l.month}<div className="tiny muted nw">Due {fmtDate(l.dueDate)}</div></td>
                      <td className="num">{RS(l.gross)}</td>
                      <td className="num">{l.discount ? <span style={{ color: 'var(--brand)' }}>− {RS(l.discount)}</span> : '—'}</td>
                      <td className="num">{l.lateFee ? <span style={{ color: 'var(--crit)' }}>+ {RS(l.lateFee)}</span> : '—'}</td>
                      <td className="num">{l.paid ? RS(l.paid) : '—'}</td>
                      <td className="num" style={{ fontWeight: 700 }}>{l.balance ? RS(l.balance) : '—'}</td>
                      <td><Chip tone={st.k}>{st.t}</Chip></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--surface-2)' }}>
                  <td colSpan={2} style={{ fontWeight: 700 }}>Total</td>
                  <td className="num" style={{ fontWeight: 700 }}>{RS(totals.gross)}</td>
                  <td className="num" style={{ fontWeight: 700, color: 'var(--brand)' }}>{RS(totals.discount)}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{RS(totals.lateFee)}</td>
                  <td className="num" style={{ fontWeight: 700, color: 'var(--good)' }}>{RS(totals.paid)}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{RS(totals.outstanding)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </Panel>

        <Panel bodyless title="Payment history">
          <div className="tbl-wrap">
            <table>
              <tbody>
                {receipts.length === 0 && <tr><td><Empty>No payment recorded yet.</Empty></td></tr>}
                {receipts.map((r) => (
                  <tr key={r._id} className="clickable" onClick={() => setReceiptId(r._id)}>
                    <td>
                      <div className="mono tiny" style={{ color: 'var(--brand)', fontWeight: 600 }}>{r.receiptNo}</div>
                      <div className="tiny muted">{fmtDate(r.date)} · {r.mode}</div>
                      {r.type === 'misc' ? (
                        <div style={{ marginTop: 3 }}><Chip tone="part">Other: {r.miscHead || 'Misc'}</Chip></div>
                      ) : (
                        <div className="tiny muted">Inst. {r.lines?.map((l) => l.instNo).join(', ')}</div>
                      )}
                      {r.cancelled?.at && <Chip tone="over">Cancelled</Chip>}
                    </td>
                    <td className="num" style={{ fontWeight: 700 }}>{RS(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {receiptId && <ReceiptView id={receiptId} onClose={() => setReceiptId(null)} onChanged={load} />}

      {editingDetails && editForm && (
        <Drawer
          wide
          title={`Edit Details · ${s.admissionNo}`}
          sub={s.name}
          onClose={() => setEditingDetails(false)}
          footer={(
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', width: '100%' }}>
              <button type="button" className="btn" onClick={() => setEditingDetails(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" disabled={savingDetails} onClick={saveDetails}>
                {savingDetails ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          )}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div className="lbl" style={{ marginBottom: 8, color: 'var(--brand)', fontWeight: 700 }}>Basic Info</div>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
                <Field label="Full Name *" error={editErrors.name}>
                  <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} error={editErrors.name} />
                </Field>
                <Field label="Date of Birth">
                  <Input type="date" value={editForm.dob} onChange={(e) => setEditForm({ ...editForm, dob: e.target.value })} />
                </Field>
                <Field label="Blood Group">
                  <Input value={editForm.bloodGroup} onChange={(e) => setEditForm({ ...editForm, bloodGroup: e.target.value })} placeholder="e.g. O+" />
                </Field>
              </div>
            </div>

            <div style={{ paddingTop: 12, borderTop: '1px dashed var(--line)' }}>
              <div className="lbl" style={{ marginBottom: 8, color: 'var(--brand)', fontWeight: 700 }}>Parent / Guardian Info & Aadhaar</div>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
                <Field label="Father Name *" error={editErrors.father}>
                  <Input value={editForm.father} onChange={(e) => setEditForm({ ...editForm, father: e.target.value })} error={editErrors.father} />
                </Field>
                <Field label="Mother Name">
                  <Input value={editForm.mother} onChange={(e) => setEditForm({ ...editForm, mother: e.target.value })} />
                </Field>
                <Field label={`Father Aadhaar (12 digits)${editForm.fatherAadhaar ? ` · ${editForm.fatherAadhaar.length}/12` : ''}`} error={editErrors.fatherAadhaar}>
                  <Input className="input mono" inputMode="numeric" maxLength={12} value={editForm.fatherAadhaar}
                    onChange={digits('fatherAadhaar', 12)} placeholder="12-digit Aadhaar" error={editErrors.fatherAadhaar} />
                </Field>
                <Field label={`Mother Aadhaar (12 digits)${editForm.motherAadhaar ? ` · ${editForm.motherAadhaar.length}/12` : ''}`} error={editErrors.motherAadhaar}>
                  <Input className="input mono" inputMode="numeric" maxLength={12} value={editForm.motherAadhaar}
                    onChange={digits('motherAadhaar', 12)} placeholder="12-digit Aadhaar" error={editErrors.motherAadhaar} />
                </Field>
              </div>
            </div>

            <div style={{ paddingTop: 12, borderTop: '1px dashed var(--line)' }}>
              <div className="lbl" style={{ marginBottom: 8, color: 'var(--brand)', fontWeight: 700 }}>Contact Info (2 Mobile Numbers)</div>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
                <Field label={`Primary Mobile * · ${editForm.phone.length}/10`} error={editErrors.phone}>
                  <Input className="input mono" inputMode="numeric" maxLength={10} value={editForm.phone}
                    onChange={digits('phone', 10)} placeholder="10 digits" error={editErrors.phone} />
                </Field>
                <Field label={`Alternate Mobile · ${editForm.alternatePhone ? `${editForm.alternatePhone.length}/10` : 'Optional'}`} error={editErrors.alternatePhone}>
                  <Input className="input mono" inputMode="numeric" maxLength={10} value={editForm.alternatePhone}
                    onChange={digits('alternatePhone', 10)} placeholder="Optional 2nd mobile" error={editErrors.alternatePhone} />
                </Field>
                <Field label="Email">
                  <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                </Field>
                <Field label="Occupation">
                  <Input value={editForm.occupation} onChange={(e) => setEditForm({ ...editForm, occupation: e.target.value })} />
                </Field>
                <Field label="Address" style={{ gridColumn: '1/-1' }}>
                  <textarea className="input" rows={2} value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
                </Field>
              </div>
            </div>

            <div style={{ paddingTop: 12, borderTop: '1px dashed var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div className="lbl" style={{ margin: 0, color: 'var(--brand)', fontWeight: 700 }}>Child Identification & Documents</div>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ fontSize: 11, padding: '3px 8px' }}
                  onClick={() => setShowDocModal(true)}
                >
                  📁 Upload / View Files
                </button>
              </div>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', alignItems: 'center', gap: 14 }}>
                <Field label={`Child Aadhaar (12 digits)${editForm.childAadhaar ? ` · ${editForm.childAadhaar.length}/12` : ''}`} error={editErrors.childAadhaar}>
                  <Input className="input mono" inputMode="numeric" maxLength={12} value={editForm.childAadhaar}
                    onChange={digits('childAadhaar', 12)} placeholder="12-digit Aadhaar" error={editErrors.childAadhaar} />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginTop: 10 }}>
                {/* Birth Certificate */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 'var(--r)',
                    background: editForm.birthCertificateSubmitted ? 'rgba(16, 185, 129, 0.08)' : 'var(--surface-2)',
                    border: `1px solid ${editForm.birthCertificateSubmitted ? '#10b981' : 'var(--line)'}`,
                    cursor: 'pointer'
                  }}
                  onClick={() => setEditForm((p) => ({ ...p, birthCertificateSubmitted: !p.birthCertificateSubmitted }))}
                >
                  <input
                    type="checkbox"
                    id="editBirthCert"
                    checked={editForm.birthCertificateSubmitted}
                    onChange={(e) => setEditForm((p) => ({ ...p, birthCertificateSubmitted: e.target.checked }))}
                    style={{ width: 17, height: 17, cursor: 'pointer', accentColor: '#10b981' }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <label htmlFor="editBirthCert" style={{ cursor: 'pointer', flex: 1, margin: 0, fontSize: 12.5 }}>
                    <div style={{ fontWeight: 600, color: editForm.birthCertificateSubmitted ? '#10b981' : 'var(--text)' }}>
                      Birth Certificate
                    </div>
                    <div className="tiny muted" style={{ fontSize: 10.5 }}>
                      Child birth certificate
                    </div>
                  </label>
                </div>

                {/* Father Aadhaar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 'var(--r)',
                    background: editForm.fatherAadhaarSubmitted ? 'rgba(16, 185, 129, 0.08)' : 'var(--surface-2)',
                    border: `1px solid ${editForm.fatherAadhaarSubmitted ? '#10b981' : 'var(--line)'}`,
                    cursor: 'pointer'
                  }}
                  onClick={() => setEditForm((p) => ({ ...p, fatherAadhaarSubmitted: !p.fatherAadhaarSubmitted }))}
                >
                  <input
                    type="checkbox"
                    id="editFatherAadhaar"
                    checked={editForm.fatherAadhaarSubmitted}
                    onChange={(e) => setEditForm((p) => ({ ...p, fatherAadhaarSubmitted: e.target.checked }))}
                    style={{ width: 17, height: 17, cursor: 'pointer', accentColor: '#10b981' }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <label htmlFor="editFatherAadhaar" style={{ cursor: 'pointer', flex: 1, margin: 0, fontSize: 12.5 }}>
                    <div style={{ fontWeight: 600, color: editForm.fatherAadhaarSubmitted ? '#10b981' : 'var(--text)' }}>
                      Father Aadhaar
                    </div>
                    <div className="tiny muted" style={{ fontSize: 10.5 }}>
                      Father Aadhaar card
                    </div>
                  </label>
                </div>

                {/* Mother Aadhaar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 'var(--r)',
                    background: editForm.motherAadhaarSubmitted ? 'rgba(16, 185, 129, 0.08)' : 'var(--surface-2)',
                    border: `1px solid ${editForm.motherAadhaarSubmitted ? '#10b981' : 'var(--line)'}`,
                    cursor: 'pointer'
                  }}
                  onClick={() => setEditForm((p) => ({ ...p, motherAadhaarSubmitted: !p.motherAadhaarSubmitted }))}
                >
                  <input
                    type="checkbox"
                    id="editMotherAadhaar"
                    checked={editForm.motherAadhaarSubmitted}
                    onChange={(e) => setEditForm((p) => ({ ...p, motherAadhaarSubmitted: e.target.checked }))}
                    style={{ width: 17, height: 17, cursor: 'pointer', accentColor: '#10b981' }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <label htmlFor="editMotherAadhaar" style={{ cursor: 'pointer', flex: 1, margin: 0, fontSize: 12.5 }}>
                    <div style={{ fontWeight: 600, color: editForm.motherAadhaarSubmitted ? '#10b981' : 'var(--text)' }}>
                      Mother Aadhaar
                    </div>
                    <div className="tiny muted" style={{ fontSize: 10.5 }}>
                      Mother Aadhaar card
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </Drawer>
      )}
      {confirmDelete && (
        <Confirm
          title={`Delete ${s.name}?`}
          danger="Delete Student"
          loading={deleting}
          onClose={() => !deleting && setConfirmDelete(false)}
          onOk={deleteStudent}
        >
          <p style={{ margin: '0 0 12px', fontSize: 14 }}>
            Are you sure you want to permanently delete <strong>{s.name}</strong> (Admission No: <span className="mono">{s.admissionNo}</span>, Class: {s.classId?.name}-{s.section})?
          </p>
          <div style={{ padding: '12px 14px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 8, color: 'var(--crit)', fontSize: 13, lineHeight: 1.5 }}>
            <strong>Warning:</strong> This will permanently remove the student profile, all fee ledgers, concessions, and associated payment receipts. This action cannot be undone.
          </div>
        </Confirm>
      )}
      {showDocModal && (
        <StudentDocumentModal
          student={s}
          onClose={() => setShowDocModal(false)}
          onSaved={() => {
            setShowDocModal(false);
            load();
          }}
        />
      )}
    </div>
  );
}
