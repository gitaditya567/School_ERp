import { useEffect, useRef, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Panel, Chip, Drawer, Field, Input, Select, Loading, ErrorBox, Empty, Denied } from '../components/ui';
import { Logo } from '../components/Layout';
import { RS } from '../lib/format';

export default function Settings() {
  const { can, reload, school: ctxSchool } = useAuth();
  const { toast, error: shout } = useToast();
  const [school, setSchool] = useState(null);
  const [nextNo, setNextNo] = useState('');
  const [nextAdmNo, setNextAdmNo] = useState('');
  const [admSeqNum, setAdmSeqNum] = useState('1');
  const [users, setUsers] = useState([]);
  const [matrix, setMatrix] = useState(null);
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState(null);
  const [userForm, setUserForm] = useState(null);
  const fileRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setError(null);
    try {
      const [s, m] = await Promise.all([api.get('/settings'), api.get('/roles')]);
      setSchool(s.school);
      setNextNo(s.nextReceiptNo);
      setNextAdmNo(s.nextAdmissionNo || '');
      setAdmSeqNum(s.nextAdmissionSeq !== undefined ? String(s.nextAdmissionSeq) : '1');
      setMatrix(m);
      if (can('manageUsers')) {
        const [u, c] = await Promise.all([api.get('/users'), api.get('/classes')]);
        setUsers(u.users); setClasses(c.classes);
      }
    } catch (e) { setError(e); }
  };
  useEffect(() => { document.title = 'Settings & Masters'; load(); }, []);

  if (!can('editSettings')) return <Denied message="Only the Principal and Director can open Settings & Masters." />;
  if (error) return <ErrorBox error={error} onRetry={load} />;
  if (!school || !matrix) return <Loading />;

  const set = (k) => (e) => setSchool({ ...school, [k]: e.target.value });
  const saveSchool = async () => {
    setSaving(true);
    try {
      const r = await api.patch('/settings', school);
      setSchool(r.school);
      if (r.nextAdmissionNo) setNextAdmNo(r.nextAdmissionNo);
      if (r.nextAdmissionSeq) setAdmSeqNum(String(r.nextAdmissionSeq));
      await reload();
      toast('School settings saved successfully!');
    } catch (e) {
      shout(e);
    } finally {
      setSaving(false);
    }
  };

  const previewAdmissionNo = () => {
    const prefix = (school.admissionPrefix !== undefined && school.admissionPrefix !== null && school.admissionPrefix !== '')
      ? school.admissionPrefix.trim()
      : (school.name || 'SCH').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase();

    const d = new Date();
    const fullYear = d.getFullYear().toString();
    const shortYear = fullYear.slice(-2);

    let yearPart = '';
    const yearFormat = school.admissionYearFormat || 'YY';
    if (yearFormat === 'YY') yearPart = shortYear;
    else if (yearFormat === 'YYYY') yearPart = fullYear;
    else if (yearFormat === 'session') yearPart = school.session || `${fullYear}-${(Number(shortYear) + 1).toString().padStart(2, '0')}`;

    const padLen = school.admissionPadding !== undefined ? Number(school.admissionPadding) : 4;
    const seq = parseInt(admSeqNum, 10) || 1;
    const numPart = padLen > 0 ? String(seq).padStart(padLen, '0') : String(seq);

    const sep = school.admissionSeparator || '';
    if (sep) return [prefix, yearPart, numPart].filter(Boolean).join(sep);
    return `${prefix}${yearPart}${numPart}`;
  };

  const saveAdmissionSettings = async () => {
    setSaving(true);
    try {
      const r = await api.patch('/settings', {
        ...school,
        admissionNextSeq: admSeqNum,
      });
      setSchool(r.school);
      setNextAdmNo(r.nextAdmissionNo);
      setAdmSeqNum(r.nextAdmissionSeq !== undefined ? String(r.nextAdmissionSeq) : '1');
      await reload();
      toast('Admission number sequence settings saved successfully!');
    } catch (e) {
      shout(e);
    } finally {
      setSaving(false);
    }
  };

  /* ------------------------------- logo -------------------------------- */
  const uploadLogo = (file) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) { shout('Use a PNG, JPG, SVG or WebP image'); return; }
    if (file.size > 3 * 1024 * 1024) { shout('That file is over 3 MB — please use a smaller image'); return; }
    const fr = new FileReader();
    fr.onerror = () => shout('The file could not be read');
    fr.onload = async () => {
      const send = async (dataUrl) => {
        try {
          await api.put('/settings/logo', { logo: dataUrl });
          await load(); await reload();
          toast('Logo updated — it now shows on the sidebar, receipts and the sign-in screen');
        } catch (e) { shout(e); }
      };
      if (file.type === 'image/svg+xml') { send(fr.result); return; }
      const img = new Image();
      img.onerror = () => shout('That file could not be read as an image');
      img.onload = () => {
        const max = 256; const sc = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * sc));
        c.height = Math.max(1, Math.round(img.height * sc));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        send(c.toDataURL('image/png'));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  };
  const removeLogo = async () => {
    try { await api.put('/settings/logo', { logo: '' }); await load(); await reload(); toast('Logo removed'); }
    catch (e) { shout(e); }
  };

  const saveUser = async (body, id) => {
    try {
      if (id) await api.patch(`/users/${id}`, body); else await api.post('/users', body);
      setUserForm(null); await load(); toast(id ? 'User updated' : 'User added');
    } catch (e) { shout(e); }
  };
  const deleteUser = async (id) => {
    try { const r = await api.delete(`/users/${id}`); await load(); toast(r.message); } catch (e) { shout(e); }
  };

  return (
    <div className="stack">
      <Panel bodyless title="School Logo" sub="Shown on the sidebar, every printed receipt and the sign-in screen"
        actions={ctxSchool?.logo && (
          <>
            <button type="button" className="btn btn-sm" onClick={() => fileRef.current.click()}>Replace</button>
            <button type="button" className="btn btn-sm" style={{ color: 'var(--crit)', borderColor: 'var(--crit)' }} onClick={removeLogo}>Remove</button>
          </>
        )}>
        <div className="panel-body split" style={{ gap: 22 }}>
          <div>
            <div className={`dropzone${dragging ? ' over' : ''}`} role="button" tabIndex={0}
              onClick={() => fileRef.current.click()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current.click(); } }}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); uploadLogo(e.dataTransfer.files[0]); }}>
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v13" />
              </svg>
              <div>
                <b style={{ fontSize: 13.5 }}>{ctxSchool?.logo ? 'Drop a new logo here' : 'Drop your school logo here'}</b>
                <div className="tiny muted">or click to choose a file from your computer</div>
              </div>
              <div className="tiny muted">PNG, JPG, SVG or WebP · square works best · up to 3 MB</div>
            </div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"
              style={{ display: 'none' }} onChange={(e) => { uploadLogo(e.target.files[0]); e.target.value = ''; }} />
            <p className="tiny muted" style={{ margin: '10px 0 0' }}>
              Large images are resized to 256 px before upload, so the stored file stays small.
              A transparent PNG sits best on the dark sidebar.
            </p>
          </div>
          <div>
            <div className="lbl" style={{ marginBottom: 10 }}>{ctxSchool?.logo ? 'Where it appears' : 'Current mark'}</div>
            <div className="logo-previews">
              <figure><span className="on-rail"><Logo size={34} radius={9} /></span><figcaption>Sidebar</figcaption></figure>
              <figure><span style={{ background: '#fff', padding: 8, borderRadius: 10, border: '1px solid var(--line)', display: 'grid', placeItems: 'center' }}><Logo size={40} radius={10} /></span><figcaption>Receipt</figcaption></figure>
              <figure><span className="on-rail"><Logo size={46} radius={12} /></span><figcaption>Sign-in</figcaption></figure>
            </div>
            <dl className="def" style={{ marginTop: 16 }}>
              <dt>Status</dt>
              <dd>{ctxSchool?.logo ? <Chip tone="paid">Custom logo in use</Chip> : <Chip tone="up">Default monogram</Chip>}</dd>
              {ctxSchool?.logo && <><dt>Stored</dt><dd className="tiny mono">{Math.round(ctxSchool.logo.length / 1024)} KB in the database</dd></>}
            </dl>
          </div>
        </div>
      </Panel>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: 20, alignItems: 'start' }}>
        <Panel title="School Profile" actions={<button type="button" className="btn btn-sm btn-primary" disabled={saving} onClick={saveSchool}>{saving ? 'Saving...' : 'Save Profile'}</button>}>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Field label="School name" style={{ gridColumn: '1/-1' }}><Input value={school.name} onChange={set('name')} /></Field>
            <Field label="Branch"><Input value={school.branch} onChange={set('branch')} /></Field>
            <Field label="Phone"><Input className="input mono" value={school.phone} onChange={set('phone')} /></Field>
            <Field label="Email" style={{ gridColumn: '1/-1' }}><Input value={school.email} onChange={set('email')} /></Field>
            <Field label="Cheque / DD payee name"><Input value={school.payeeName} onChange={set('payeeName')} /></Field>
            <Field label="Current session"><Input value={school.session} onChange={set('session')} placeholder="2026-27" /></Field>
          </div>
        </Panel>

        <Panel
          title="Admission Number Sequence"
          sub="Define the pattern, prefix and sequence used to generate student admission numbers"
          actions={
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={saving}
              onClick={saveAdmissionSettings}
            >
              {saving ? 'Saving...' : 'Save Sequence'}
            </button>
          }
        >
          {/* Live Preview Card */}
          <div style={{
            background: 'linear-gradient(135deg, var(--surface-2) 0%, var(--surface-3) 100%)',
            border: '1px solid var(--line)',
            borderRadius: 10,
            padding: '12px 16px',
            marginBottom: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
                Live Format Preview
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                Next student admitted will receive:
              </div>
            </div>
            <div style={{
              fontSize: 19,
              fontFamily: '"IBM Plex Mono", monospace',
              fontWeight: 800,
              color: 'var(--brand)',
              background: 'var(--surface)',
              padding: '6px 14px',
              borderRadius: 8,
              border: '1.5px solid var(--brand-line, var(--line))',
              letterSpacing: '0.04em'
            }}>
              {previewAdmissionNo()}
            </div>
          </div>

          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Prefix (School Code / Letters)">
              <Input
                className="input mono"
                value={school.admissionPrefix ?? ''}
                onChange={set('admissionPrefix')}
                placeholder={`Default: ${(school.name || 'SCH').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase()}`}
              />
            </Field>

            <Field label="Year / Session in Number">
              <Select
                value={school.admissionYearFormat || 'YY'}
                onChange={set('admissionYearFormat')}
              >
                <option value="YY">2-digit Year (e.g. {new Date().getFullYear().toString().slice(-2)})</option>
                <option value="YYYY">4-digit Year (e.g. {new Date().getFullYear()})</option>
                <option value="session">Academic Session (e.g. {school.session || '2026-27'})</option>
                <option value="none">None (No year in number)</option>
              </Select>
            </Field>

            <Field label="Separator Character">
              <Select
                value={school.admissionSeparator || ''}
                onChange={set('admissionSeparator')}
              >
                <option value="">None (e.g. PJ260001)</option>
                <option value="/">Slash / (e.g. PJ/26/0001)</option>
                <option value="-">Hyphen - (e.g. PJ-26-0001)</option>
                <option value=".">Dot . (e.g. PJ.26.0001)</option>
              </Select>
            </Field>

            <Field label="Zero Padding (Digits)">
              <Select
                value={school.admissionPadding !== undefined ? school.admissionPadding : 4}
                onChange={(e) => setSchool({ ...school, admissionPadding: Number(e.target.value) })}
              >
                <option value={4}>4 digits (e.g. 0001)</option>
                <option value={3}>3 digits (e.g. 001)</option>
                <option value={5}>5 digits (e.g. 00001)</option>
                <option value={6}>6 digits (e.g. 000001)</option>
                <option value={0}>No leading zeros (e.g. 1, 42)</option>
              </Select>
            </Field>

            <Field label="Next Sequence Number (Starting #)">
              <Input
                type="number"
                min="1"
                className="input mono"
                value={admSeqNum}
                onChange={(e) => setAdmSeqNum(e.target.value.replace(/\D/g, ''))}
                placeholder="1"
              />
            </Field>

            <Field label="Sequence Mode">
              <Select
                value={school.admissionSeqMode || 'yearly'}
                onChange={set('admissionSeqMode')}
              >
                <option value="yearly">Reset Yearly (Per Academic Year)</option>
                <option value="continuous">Continuous (Continuous counter across years)</option>
              </Select>
            </Field>
          </div>

          <p className="tiny muted" style={{ marginTop: 14, lineHeight: 1.5 }}>
            💡 <strong>Tip:</strong> If you want to start or resume from a specific number (e.g. 101 or from an offline register), update <em>Next Sequence Number</em> and click Save.
          </p>
        </Panel>

        <Panel title="Receipt & Fee Rules" actions={<button type="button" className="btn btn-sm btn-primary" disabled={saving} onClick={saveSchool}>{saving ? 'Saving...' : 'Save'}</button>}>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Receipt series prefix"><Input className="input mono" value={school.receiptPrefix || ''} onChange={set('receiptPrefix')} placeholder="e.g. PJ/26-27/" /></Field>
            <Field label="Next receipt no."><Input className="input mono" readOnly value={nextNo} /></Field>
            <Field label="Fee window"><Input value={school.feeWindow || ''} onChange={set('feeWindow')} placeholder="e.g. 1st – 10th of month" /></Field>
            <Field label="Re-admission charge (₹)"><Input className="input num" value={school.readmissionCharge ?? 0} onChange={set('readmissionCharge')} /></Field>
            <Field label="Full-session advance concession (₹)" style={{ gridColumn: '1/-1' }}>
              <Input className="input num" value={school.advanceConcession ?? 0} onChange={set('advanceConcession')} />
            </Field>
          </div>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>Late Fee Calculation Rules</div>
                <div className="tiny muted" style={{ marginTop: 2 }}>Define late fee charges based on delay days</div>
              </div>
              <div className="seg">
                <button
                  type="button"
                  aria-pressed={!school.lateFeeStructure || school.lateFeeStructure === 'tiered'}
                  onClick={() => setSchool({ ...school, lateFeeStructure: 'tiered' })}
                >
                  3 Conditions (Tiered)
                </button>
                <button
                  type="button"
                  aria-pressed={school.lateFeeStructure === 'flat'}
                  onClick={() => setSchool({ ...school, lateFeeStructure: 'flat' })}
                >
                  Flat Amount
                </button>
              </div>
            </div>

            {(!school.lateFeeStructure || school.lateFeeStructure === 'tiered') ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ borderRadius: 9, border: '1px solid var(--line)', overflow: 'hidden', background: 'var(--surface)' }}>
                  <div className="tbl-wrap">
                    <table style={{ margin: 0, width: '100%', minWidth: 380 }}>
                      <thead>
                        <tr style={{ background: 'var(--surface-2)' }}>
                          <th style={{ width: 120, padding: '9px 14px' }}>Condition</th>
                          <th style={{ padding: '9px 14px' }}>Delay Criteria</th>
                          <th style={{ width: 140, padding: '9px 14px', textAlign: 'right' }}>Late Fee (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Condition 1 */}
                        <tr>
                          <td style={{ padding: '10px 14px' }}>
                            <span className="chip" style={{ background: 'rgba(224, 70, 128, 0.14)', color: 'var(--brand)', fontWeight: 700 }}>
                              Condition 1
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>Up to</span>
                              <Input
                                className="input num"
                                style={{ width: 70, padding: '5px 8px', fontWeight: 700 }}
                                value={school.lateFeeTier1Days ?? 10}
                                onChange={set('lateFeeTier1Days')}
                                placeholder="10"
                              />
                              <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>days late</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <span className="mono" style={{ fontWeight: 700, color: 'var(--brand)' }}>₹</span>
                              <Input
                                className="input num"
                                style={{ width: 95, padding: '5px 8px', fontWeight: 700, color: 'var(--brand)' }}
                                value={school.lateFeeTier1Amount ?? 200}
                                onChange={set('lateFeeTier1Amount')}
                                placeholder="200"
                              />
                            </div>
                          </td>
                        </tr>

                        {/* Condition 2 */}
                        <tr>
                          <td style={{ padding: '10px 14px' }}>
                            <span className="chip" style={{ background: 'rgba(245, 158, 11, 0.14)', color: 'var(--warn)', fontWeight: 700 }}>
                              Condition 2
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
                                {(Number(school.lateFeeTier1Days) || 10) + 1} to
                              </span>
                              <Input
                                className="input num"
                                style={{ width: 70, padding: '5px 8px', fontWeight: 700 }}
                                value={school.lateFeeTier2Days ?? 20}
                                onChange={set('lateFeeTier2Days')}
                                placeholder="20"
                              />
                              <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>days late</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <span className="mono" style={{ fontWeight: 700, color: 'var(--warn)' }}>₹</span>
                              <Input
                                className="input num"
                                style={{ width: 95, padding: '5px 8px', fontWeight: 700, color: 'var(--warn)' }}
                                value={school.lateFeeTier2Amount ?? 300}
                                onChange={set('lateFeeTier2Amount')}
                                placeholder="300"
                              />
                            </div>
                          </td>
                        </tr>

                        {/* Condition 3 */}
                        <tr>
                          <td style={{ padding: '10px 14px' }}>
                            <span className="chip" style={{ background: 'rgba(239, 68, 68, 0.14)', color: 'var(--crit)', fontWeight: 700 }}>
                              Condition 3
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>More than</span>
                              <span className="mono" style={{
                                fontWeight: 700,
                                padding: '4px 10px',
                                background: 'var(--surface-3)',
                                borderRadius: 6,
                                border: '1px solid var(--line)',
                                fontSize: 13
                              }}>
                                {school.lateFeeTier2Days || 20}
                              </span>
                              <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>days late</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <span className="mono" style={{ fontWeight: 700, color: 'var(--crit)' }}>₹</span>
                              <Input
                                className="input num"
                                style={{ width: 95, padding: '5px 8px', fontWeight: 700, color: 'var(--crit)' }}
                                value={school.lateFeeTier3Amount ?? 500}
                                onChange={set('lateFeeTier3Amount')}
                                placeholder="500"
                              />
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Active Rule Summary Card */}
                <div style={{
                  padding: '9px 14px',
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, rgba(224, 70, 128, 0.08), rgba(224, 70, 128, 0.02))',
                  border: '1px solid var(--brand-line)',
                  fontSize: 12,
                  color: 'var(--text)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap'
                }}>
                  <span style={{ fontSize: 15 }}>⚡</span>
                  <div>
                    <b>Live Rule:</b> 1 to {school.lateFeeTier1Days || 10}d = <b style={{ color: 'var(--brand)' }}>₹{school.lateFeeTier1Amount ?? 200}</b> · {(Number(school.lateFeeTier1Days) || 10) + 1} to {school.lateFeeTier2Days || 20}d = <b style={{ color: 'var(--warn)' }}>₹{school.lateFeeTier2Amount ?? 300}</b> · &gt;{school.lateFeeTier2Days || 20}d = <b style={{ color: 'var(--crit)' }}>₹{school.lateFeeTier3Amount ?? 500}</b>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', padding: 14, background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--line)' }}>
                <Field label="Late fee after (day of month)"><Input className="input num" value={school.lateFeeFrom ?? 20} onChange={set('lateFeeFrom')} placeholder="20" /></Field>
                <Field label="Late fee amount (₹)"><Input className="input num" value={school.lateFeeAmount ?? 0} onChange={set('lateFeeAmount')} placeholder="200" /></Field>
              </div>
            )}
          </div>

          <p className="tiny muted" style={{ margin: '14px 0 0' }}>
            Changing the prefix does not renumber past receipts — the sequence continues from {nextNo}.
          </p>
        </Panel>
      </div>

      {can('manageUsers') && (
        <Panel bodyless title="Users" sub="Each account signs in with its own email — the role decides what it can do"
          actions={<button type="button" className="btn btn-sm btn-primary" onClick={() => setUserForm({})}>+ User</button>}>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Scope</th><th>Concession limit</th><th>Last sign-in</th><th className="t-right">Actions</th></tr></thead>
              <tbody>
                {users.length === 0 && <tr><td colSpan={7}><Empty>No user yet.</Empty></td></tr>}
                {users.map((u) => {
                  const role = matrix.roles.find((r) => r.key === u.role);
                  return (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600 }}>{u.name} {!u.active && <Chip tone="over">inactive</Chip>}</td>
                      <td className="mono tiny">{u.email}</td>
                      <td><span className="tag">{role?.label}</span></td>
                      <td className="tiny muted">{u.className || 'Whole school'}</td>
                      <td className="num">{role?.maxDiscount === null ? 'No limit' : role?.maxDiscount ? RS(role.maxDiscount) : '—'}</td>
                      <td className="tiny muted">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'never'}</td>
                      <td className="t-right nw">
                        <button type="button" className="btn btn-sm" onClick={() => setUserForm(u)}>Edit</button>
                        <button type="button" className="btn btn-sm btn-ghost" style={{ color: 'var(--crit)' }} onClick={() => deleteUser(u.id)}>Delete</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <Panel bodyless title="Role permissions" sub="A locked action is hidden from that user, and refused by the server as well">
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Action</th>{matrix.roles.map((r) => <th key={r.key} className="t-right">{r.label}</th>)}</tr></thead>
            <tbody>
              {matrix.permissions.map((p) => (
                <tr key={p}>
                  <td style={{ fontWeight: 600 }}>{matrix.labels[p]}</td>
                  {matrix.roles.map((r) => (
                    <td key={r.key} className={`t-right ${r.can[p] ? 'perm-yes' : 'perm-no'}`}>{r.can[p] ? '✓' : '—'}</td>
                  ))}
                </tr>
              ))}
              <tr>
                <td style={{ fontWeight: 600 }}>Concession limit</td>
                {matrix.roles.map((r) => (
                  <td key={r.key} className="num tiny">{r.maxDiscount === null ? 'No limit' : r.maxDiscount ? RS(r.maxDiscount) : 'None'}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <div className="panel-body" style={{ borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {matrix.roles.map((r) => (
            <div key={r.key} className="tiny"><b>{r.label}</b> <span className="muted">— {r.description}</span></div>
          ))}
        </div>
      </Panel>

      <div className="panel" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13.5 }}>{school?.name || 'School'} ERP</div>
          <div className="tiny muted">Admission, instalment-wise fee collection, receipts and accounts system.</div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'right' }}>
          <div>© {new Date().getFullYear()} All rights reserved.</div>
          <div>
            Developed by{' '}
            <a href="https://twinscloud.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand)', fontWeight: 600 }}>
              Twinscloud Pvt. Ltd.
            </a>
          </div>
        </div>
      </div>

      {userForm && (
        <UserForm existing={userForm.id ? userForm : null} roles={matrix.roles} classes={classes}
          onClose={() => setUserForm(null)} onSave={(body) => saveUser(body, userForm.id)} />
      )}
    </div>
  );
}

function UserForm({ existing, roles, classes, onSave, onClose }) {
  const [f, setF] = useState({
    name: existing?.name || '', email: existing?.email || '', password: '',
    role: existing?.role || 'accountant', classId: existing?.classId || '', active: existing?.active ?? true,
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const body = existing
    ? { name: f.name, role: f.role, classId: f.classId, active: f.active, ...(f.password ? { password: f.password } : {}) }
    : f;
  return (
    <Drawer title={existing ? `Edit ${existing.name}` : 'Add a user'} sub="Settings" onClose={onClose} footer={(
      <>
        <button type="button" className="btn btn-primary" onClick={() => onSave(body)}>{existing ? 'Save user' : 'Create user'}</button>
        <div style={{ flex: 1 }} />
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </>
    )}>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Field label="Full name *" style={{ gridColumn: '1/-1' }}><Input value={f.name} onChange={set('name')} /></Field>
        <Field label="Email *" style={{ gridColumn: '1/-1' }}><Input type="email" value={f.email} onChange={set('email')} readOnly={Boolean(existing)} /></Field>
        <Field label={existing ? 'New password (leave blank to keep)' : 'Password *'}>
          <Input type="password" value={f.password} onChange={set('password')} placeholder="At least 8 characters" />
        </Field>
        <Field label="Role">
          <Select value={f.role} onChange={set('role')}>{roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}</Select>
        </Field>
        {f.role === 'teacher' && (
          <Field label="Class *" style={{ gridColumn: '1/-1' }}>
            <Select value={f.classId} onChange={set('classId')}>
              <option value="">— choose a class —</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        )}
        {existing && (
          <Field label="Status">
            <Select value={String(f.active)} onChange={(e) => setF({ ...f, active: e.target.value === 'true' })}>
              <option value="true">Active</option><option value="false">Deactivated</option>
            </Select>
          </Field>
        )}
      </div>
      <p className="tiny muted" style={{ margin: '14px 0 0' }}>
        {roles.find((r) => r.key === f.role)?.description}
      </p>
    </Drawer>
  );
}
