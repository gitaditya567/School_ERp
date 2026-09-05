import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/Layout';
import { Loading, Denied } from './components/ui';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import StudentProfile from './pages/StudentProfile';
import NewAdmission from './pages/NewAdmission';
import CollectFee from './pages/CollectFee';
import Receipts from './pages/Receipts';
import FeeMaster from './pages/FeeMaster';
import Concessions from './pages/Concessions';
import DayBook from './pages/DayBook';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

function Guard({ view, children }) {
  const { user, canView, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" state={{ from: loc }} replace />;
  if (view && !canView(view)) return <Denied message={`The ${view} module is not available for your role.`} />;
  return children;
}

function Shell() {
  const { loading, user } = useAuth();
  if (loading) return <Loading label="Starting…" />;
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={user ? <Layout /> : <Navigate to="/login" replace />}>
        <Route index element={<Guard view="dashboard"><Dashboard /></Guard>} />
        <Route path="admission" element={<Guard view="admission"><NewAdmission /></Guard>} />
        <Route path="students" element={<Guard view="students"><Students /></Guard>} />
        <Route path="students/:id" element={<Guard view="student"><StudentProfile /></Guard>} />
        <Route path="collect" element={<Guard view="collect"><CollectFee /></Guard>} />
        <Route path="receipts" element={<Guard view="receipts"><Receipts /></Guard>} />
        <Route path="fee-master" element={<Guard view="feemaster"><FeeMaster /></Guard>} />
        <Route path="concessions" element={<Guard view="concessions"><Concessions /></Guard>} />
        <Route path="day-book" element={<Guard view="daybook"><DayBook /></Guard>} />
        <Route path="reports" element={<Guard view="reports"><Reports /></Guard>} />
        <Route path="settings" element={<Guard view="settings"><Settings /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Shell />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
