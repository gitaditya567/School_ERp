import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const push = useCallback((message, tone = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setItems((list) => [...list, { id, message, tone }]);
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 3600);
  }, []);

  const value = useMemo(() => ({
    toast: push,
    error: (e) => push(typeof e === 'string' ? e : (e?.message || 'Something went wrong.'), 'error'),
  }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div id="toast">
        {items.map((t) => (
          <div key={t.id} className="toast" style={t.tone === 'error' ? { background: 'var(--crit)' } : undefined}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
