import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [school, setSchool] = useState(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    try {
      const data = await api.get('/auth/me');
      setUser(data.user); setRole(data.role); setSchool(data.school);
    } catch {
      setUser(null); setRole(null);
      localStorage.removeItem('erp_token');
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const s = await api.get('/auth/status');
        setNeedsSetup(s.needsSetup);
        if (!s.needsSetup) setSchool((prev) => prev || s.school);
      } catch { /* API down — the login screen will say so */ }
      if (localStorage.getItem('erp_token')) await loadMe();
      setLoading(false);
    })();
  }, [loadMe]);

  const finishAuth = (data) => {
    localStorage.setItem('erp_token', data.token);
    setUser(data.user); setRole(data.role); setNeedsSetup(false);
    return loadMe();
  };

  const login = async (email, password) => finishAuth(await api.post('/auth/login', { email, password }));
  const bootstrap = async (payload) => finishAuth(await api.post('/auth/bootstrap', payload));
  const logout = () => { localStorage.removeItem('erp_token'); setUser(null); setRole(null); };

  const value = useMemo(() => ({
    user, role, school, setSchool, needsSetup, loading, login, bootstrap, logout, reload: loadMe,
    can: (p) => Boolean(role?.can?.[p]),
    canView: (v) => Boolean(role?.views?.includes(v)),
    maxDiscount: role?.maxDiscount === null ? Infinity : (role?.maxDiscount ?? 0),
  }), [user, role, school, needsSetup, loading, loadMe]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
