import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Field, Input } from '../components/ui';

export default function Login() {
  const { user, school, needsSetup, login, bootstrap } = useAuth();
  const setup = needsSetup;
  const [form, setForm] = useState({ name: '', schoolName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      if (setup) await bootstrap(form);
      else await login(form.email, form.password);
    } catch (err) {
      setError(err.message);
      setForm((f) => ({ ...f, password: '' }));
    } finally { setBusy(false); }
  };

  return (
    <div className="login">
      <div className="login-brand">
        <div className="brand-mark" style={{ width: 46, height: 46, fontSize: 19, borderRadius: 12 }}>
          {school?.logo ? <img src={school.logo} alt="" style={{ maxWidth: '100%', maxHeight: '100%' }} /> : 'SC'}
        </div>
        <div>
          <h1 style={{ fontSize: 30, color: '#fff', lineHeight: 1.12 }}>{school?.name || 'School ERP'}</h1>
          <p style={{ color: 'var(--rail-text)', fontSize: 14, maxWidth: '34ch', margin: '10px 0 0' }}>
            Admission, instalment-wise fee collection, receipts and reports — in one place.
          </p>
        </div>
        <div className="login-stats">
          <div><b className="mono">1</b><span>fee ledger per student</span></div>
          <div><b className="mono">5</b><span>roles with own access</span></div>
          <div><b className="mono">0</b><span>duplicate receipt numbers</span></div>
        </div>
        <div className="login-brand-foot">
          <span>{school?.branch || ''}</span>
          <span>
            © {new Date().getFullYear()} Developed by{' '}
            <a href="https://twinscloud.com" target="_blank" rel="noopener noreferrer">
              Twinscloud Pvt. Ltd.
            </a>
          </span>
        </div>
      </div>

      <div className="login-form">
        <div className="login-card">
          <div className="lbl">{setup ? 'First-time setup' : 'Sign in'}</div>
          <h2 style={{ fontSize: 22, margin: '4px 0' }}>{setup ? 'Create the Principal account' : 'Welcome back'}</h2>
          <p className="tiny muted" style={{ margin: '0 0 18px' }}>
            {setup
              ? 'No user exists yet. This first account gets full control and can invite everyone else.'
              : 'Your role decides which modules and actions you can use.'}
          </p>

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {setup && (
              <>
                <Field label="School name"><Input value={form.schoolName} onChange={set('schoolName')} placeholder="e.g. Sunrise Preschool" /></Field>
                <Field label="Your full name"><Input value={form.name} onChange={set('name')} required minLength={3} /></Field>
              </>
            )}
            <Field label="Email">
              <Input type="email" autoComplete="username" value={form.email} onChange={set('email')} required placeholder="you@school.in" />
            </Field>
            <Field label="Password">
              <Input type="password" autoComplete={setup ? 'new-password' : 'current-password'}
                value={form.password} onChange={set('password')} required minLength={setup ? 8 : 1}
                placeholder={setup ? 'At least 8 characters' : 'Enter password'} />
            </Field>
            <div className="err" style={{ minHeight: 15 }}>{error}</div>
            <button type="submit" className="btn btn-primary" disabled={busy}
              style={{ justifyContent: 'center', padding: 10 }}>
              {busy ? 'Please wait…' : (setup ? 'Create account & sign in' : 'Sign in')}
            </button>
          </form>

          {!setup && (
            <p className="tiny muted" style={{ marginTop: 16 }}>
              Forgot your password? Ask the Principal to reset it from Settings → Users.
            </p>
          )}

          <div className="login-copy">
            © {new Date().getFullYear()} Developed by{' '}
            <a href="https://twinscloud.com" target="_blank" rel="noopener noreferrer">
              <strong>Twinscloud Pvt. Ltd.</strong>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
