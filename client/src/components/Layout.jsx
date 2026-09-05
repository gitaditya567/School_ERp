import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { initials } from '../lib/format';
import { Drawer } from './ui';

const I = {
  dash: <path d="M3 13h8V3H3zM13 21h8V11h-8zM13 7h8V3h-8zM3 21h8v-4H3z" />,
  add: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></>,
  users: <><path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /></>,
  rupee: <path d="M6 3h12M6 8h12M16 3c0 5-4 5-7 5 3 0 7 3 9 8M6 21h4" />,
  card: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  tag: <><path d="M20.6 13.4 12 22l-9-9V3h10z" /><circle cx="7.5" cy="7.5" r="1.3" /></>,
  wallet: <><path d="M20 12V8H6a2 2 0 0 1 0-4h12v4" /><path d="M4 6v12a2 2 0 0 0 2 2h14v-4" /><path d="M18 12a2 2 0 0 0 0 4h4v-4z" /></>,
  report: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 17v-4M12 17v-6M15 17v-2" /></>,
  cog: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 14.1a2 2 0 1 1 0-4 1.6 1.6 0 0 0 1.4-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 3.2V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1.2z" /></>,
};

const NAV = [
  { group: 'Overview', items: [{ to: '/', end: true, view: 'dashboard', label: 'Dashboard', icon: I.dash }] },
  { group: 'Admission', items: [
    { to: '/admission', view: 'admission', label: 'New Admission', icon: I.add },
    { to: '/students', view: 'students', label: 'Students', icon: I.users },
  ] },
  { group: 'Fee & Accounts', items: [
    { to: '/collect', view: 'collect', label: 'Collect Fee', icon: I.rupee },
    { to: '/receipts', view: 'receipts', label: 'Receipt Register', icon: I.card },
    { to: '/fee-master', view: 'feemaster', label: 'Fee Master', icon: I.grid },
    { to: '/concessions', view: 'concessions', label: 'Concessions', icon: I.tag },
    { to: '/day-book', view: 'daybook', label: 'Day Book / Expenses', icon: I.wallet },
  ] },
  { group: 'Analysis', items: [{ to: '/reports', view: 'reports', label: 'Reports', icon: I.report }] },
  { group: 'System', items: [{ to: '/settings', view: 'settings', label: 'Settings & Masters', icon: I.cog }] },
];

export function Logo({ size = 34, radius = 9 }) {
  const { school } = useAuth();
  const box = { width: size, height: size, borderRadius: radius };
  if (school?.logo) {
    return <span className="logo-box" style={box}><img src={school.logo} alt="School logo" /></span>;
  }
  const text = (school?.name || 'SC').split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return <span className="brand-mark" style={{ ...box, fontSize: Math.max(11, Math.round(size * 0.42)) }}>{text}</span>;
}

export default function Layout() {
  const { user, role, school, canView, can, logout } = useAuth();
  const { toast } = useToast();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);

  const toggleTheme = () => {
    const cur = document.documentElement.getAttribute('data-theme');
    const dark = cur ? cur === 'dark' : window.matchMedia('(prefers-color-scheme:dark)').matches;
    const next = dark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('erp_theme', next);
  };

  const doLogout = () => {
    const name = user?.name;
    logout();
    setConfirmOut(false);
    toast(`${name} signed out`);
    nav('/login', { replace: true });
  };

  return (
    <div className="app">
      <aside className={`rail${open ? ' open' : ''}`}>
        <div className="brand">
          <Logo />
          <div style={{ minWidth: 0 }}>
            <div className="brand-name">{school?.name || 'School ERP'}</div>
            <div className="brand-sub">{school?.branch || school?.session || 'ERP'}</div>
          </div>
        </div>
        <nav className="nav">
          {NAV.map((g) => {
            const items = g.items.filter((it) => canView(it.view));
            if (!items.length) return null;
            return (
              <div key={g.group}>
                <div className="nav-group">{g.group}</div>
                {items.map((it) => (
                  <NavLink key={it.to} to={it.to} end={it.end} className="nav-item" onClick={() => setOpen(false)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">{it.icon}</svg>
                    <span>{it.label}</span>
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="rail-foot">
          <div className="avatar">{initials(user?.name || '')}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="who">{user?.name}</div>
            <div className="role">{role?.label}{user?.className ? ` · ${user.className}` : ''}</div>
          </div>
          <button type="button" className="icon-btn" onClick={toggleTheme} title="Switch theme" aria-label="Switch theme">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
            </svg>
          </button>
          <button type="button" className="icon-btn" onClick={() => setConfirmOut(true)} title="Log out" aria-label="Log out">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button type="button" className="icon-btn no-print" style={{ color: 'var(--text-2)' }}
            onClick={() => setOpen((v) => !v)} aria-label="Menu">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
          </button>
          <div>
            <div className="tb-crumb">{school?.session ? `Session ${school.session}` : 'School ERP'}</div>
            <div className="tb-title" id="page-title">{document.title}</div>
          </div>
          <div className="tb-spacer" />
          {can('collect') && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => nav('/collect')}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
              Fee Collect
            </button>
          )}
        </header>
        <main className="content"><Outlet /></main>
      </div>

      {confirmOut && (
        <Drawer title="Log out" sub="Session" onClose={() => setConfirmOut(false)}
          footer={(
            <>
              <button type="button" className="btn btn-primary" onClick={doLogout}>Log out</button>
              <div style={{ flex: 1 }} />
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmOut(false)}>Stay signed in</button>
            </>
          )}>
          <p style={{ margin: '0 0 6px' }}>Signed in as <b>{user?.name}</b> — {role?.label}.</p>
          <p className="tiny muted" style={{ margin: 0 }}>You will be returned to the sign-in screen. Nothing you have saved is lost.</p>
        </Drawer>
      )}
    </div>
  );
}
