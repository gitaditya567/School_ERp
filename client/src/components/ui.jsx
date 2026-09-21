import { useEffect } from 'react';

export const Panel = ({ title, sub, actions, children, className = '', bodyless }) => (
  <div className={`panel ${className}`}>
    {(title || actions) && (
      <div className="panel-head" style={{ flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          {title && <h3>{title}</h3>}
          {sub && <div className="sub">{sub}</div>}
        </div>
        {actions}
      </div>
    )}
    {bodyless ? children : <div className="panel-body">{children}</div>}
  </div>
);

export const Chip = ({ tone = 'up', children }) => (
  <span className={`chip ${tone}`}><i className="dot" />{children}</span>
);

export const Field = ({ label, error, children, style }) => (
  <label className="field" style={style}>
    <span>{label}</span>
    {children}
    {error && <em className="err">{error}</em>}
  </label>
);

export const Input = ({ error, ...rest }) => <input className={`input${error ? ' invalid' : ''}`} {...rest} />;
export const Select = ({ error, children, ...rest }) => (
  <select className={`input${error ? ' invalid' : ''}`} {...rest}>{children}</select>
);

export const Empty = ({ children }) => <div className="empty">{children}</div>;

export const Loading = ({ label = 'Loading…' }) => (
  <div className="center-page"><div className="spinner" /><span className="tiny muted">{label}</span></div>
);

export const ErrorBox = ({ error, onRetry }) => (
  <Panel title="Could not load this screen">
    <p className="muted" style={{ margin: '0 0 12px' }}>{error?.message || 'Unknown error.'}</p>
    {onRetry && <button type="button" className="btn" onClick={onRetry}>Try again</button>}
  </Panel>
);

export const Denied = ({ message }) => (
  <div className="panel">
    <div className="panel-body" style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: 26 }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--crit-soft)', color: 'var(--crit)', display: 'grid', placeItems: 'center', flex: 'none' }}>
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
      </div>
      <div>
        <h3 style={{ fontSize: 16 }}>Access restricted</h3>
        <p className="muted" style={{ margin: '5px 0 0', fontSize: 13 }}>{message}</p>
      </div>
    </div>
  </div>
);

export function Drawer({ title, sub, onClose, children, footer, wide }) {
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    document.body.style.overflow = 'hidden';
    document.body.classList.add('drawer-open');
    return () => {
      document.removeEventListener('keydown', esc);
      document.body.style.overflow = '';
      document.body.classList.remove('drawer-open');
    };
  }, [onClose]);

  return (
    <div className="drawer-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`drawer${wide ? ' wide' : ''}`} role="dialog" aria-modal="true">
        <div className="drawer-head no-print">
          <div style={{ flex: 1 }}>
            {sub && <div className="lbl">{sub}</div>}
            <h3 style={{ fontSize: 16 }}>{title}</h3>
          </div>
          <button type="button" className="btn btn-sm btn-ghost no-print" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-foot no-print">{footer}</div>}
      </div>
    </div>
  );
}

export const Kpi = ({ label, value, foot, accent, color }) => (
  <div className={`kpi${accent ? ' accent' : ''}`}>
    <div className="k-lbl">{label}</div>
    <div className="k-val" style={color ? { color } : undefined}>{value}</div>
    {foot && <div className="k-foot" style={{ justifyContent: 'space-between' }}>{foot}</div>}
  </div>
);

export const Bar = ({ pct, color = 'var(--good)' }) => (
  <div className="bar"><i style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }} /></div>
);

export const Confirm = ({ title, sub = 'Confirm action', danger = 'Delete', loading = false, onOk, onClose, children }) => (
  <Drawer title={title} sub={sub} onClose={onClose} footer={(
    <>
      <button
        type="button"
        className="btn btn-primary"
        style={{ background: 'var(--crit)', borderColor: 'var(--crit)' }}
        onClick={onOk}
        disabled={loading}
      >
        {loading ? 'Deleting…' : danger}
      </button>
      <div style={{ flex: 1 }} />
      <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>
        Cancel
      </button>
    </>
  )}>
    {children}
  </Drawer>
);
