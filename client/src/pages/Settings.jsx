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
      setSchool(s.school); setNextNo(s.nextReceiptNo); setMatrix(m);
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
      await reload();
      toast('School settings saved successfully!');
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

      <div className="split">
        <Panel title="School Profile" actions={<button type="button" className="btn btn-sm btn-primary" disabled={saving} onClick={saveSchool}>{saving ? 'Saving...' : 'Save'}</button>}>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Field label="School name" style={{ gridColumn: '1/-1' }}><Input value={school.name} onChange={set('name')} /></Field>
            <Field label="Branch"><Input value={school.branch} onChange={set('branch')} /></Field>
            <Field label="Phone"><Input className="input mono" value={school.phone} onChange={set('phone')} /></Field>
            <Field label="Email" style={{ gridColumn: '1/-1' }}><Input value={school.email} onChange={set('email')} /></Field>
            <Field label="Cheque / DD payee name"><Input value={school.payeeName} onChange={set('payeeName')} /></Field>
            <Field label="Current session"><Input value={school.session} onChange={set('session')} placeholder="2026-27" /></Field>
          </div>
        </Panel>

        <Panel title="Receipt & Fee Rules" actions={<button type="button" className="btn btn-sm btn-primary" disabled={saving} onClick={saveSchool}>{saving ? 'Saving...' : 'Save'}</button>}>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Field label="Receipt series prefix"><Input className="input mono" value={school.receiptPrefix} onChange={set('receiptPrefix')} /></Field>
            <Field label="Next receipt no."><Input className="input mono" readOnly value={nextNo} /></Field>
            <Field label="Fee window"><Input value={school.feeWindow} onChange={set('feeWindow')} /></Field>
            <Field label="Late fee after (day)"><Input className="input num" value={school.lateFeeFrom} onChange={set('lateFeeFrom')} /></Field>
            <Field label="Late fee amount"><Input className="input num" value={school.lateFeeAmount} onChange={set('lateFeeAmount')} /></Field>
            <Field label="Re-admission charge"><Input className="input num" value={school.readmissionCharge} onChange={set('readmissionCharge')} /></Field>
            <Field label="Full-session advance concession" style={{ gridColumn: '1/-1' }}>
              <Input className="input num" value={school.advanceConcession} onChange={set('advanceConcession')} />
            </Field>
          </div>
          <p className="tiny muted" style={{ margin: '12px 0 0' }}>
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
