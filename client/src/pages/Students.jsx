import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Panel, Chip, Loading, ErrorBox, Empty, Input, Select } from '../components/ui';
import { RS, fmtDate, downloadCSV, initials } from '../lib/format';

export default function Students() {
  const { can, user } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState(null);
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState(null);
  const [f, setF] = useState({ search: '', classId: '', status: '' });

  useEffect(() => { document.title = 'Student Directory'; api.get('/classes').then((d) => setClasses(d.classes)).catch(() => {}); }, []);
  useEffect(() => {
    const id = setTimeout(() => {
      setError(null);
      api.get('/students', { params: f }).then((d) => setRows(d.students)).catch(setError);
    }, 220);
    return () => clearTimeout(id);
  }, [f.search, f.classId, f.status]);

  if (error) return <ErrorBox error={error} onRetry={() => setF({ ...f })} />;

  const exportCsv = () => downloadCSV('students.csv',
    ['Adm No', 'Name', 'Class', 'Father', 'Mother', 'Phone', 'Net payable', 'Paid', 'Outstanding'],
    rows.map((s) => [s.admissionNo, s.name, s.classId?.name, s.father, s.mother, s.phone,
      s.totals.payable, s.totals.paid, s.totals.outstanding]));

  return (
    <Panel bodyless title="Student Directory"
      sub={rows ? `${rows.length} student${rows.length === 1 ? '' : 's'}${user?.className ? ` · ${user.className} only` : ''}` : ' '}
      actions={(
        <>
          <Input style={{ width: 190 }} placeholder="Name / Adm. No / Mobile"
            value={f.search} onChange={(e) => setF({ ...f, search: e.target.value })} />
          {!user?.className && (
            <Select style={{ width: 'auto' }} value={f.classId} onChange={(e) => setF({ ...f, classId: e.target.value })}>
              <option value="">All classes</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          )}
          <Select style={{ width: 'auto' }} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            <option value="">All statuses</option>
            <option value="due">Due pending</option>
            <option value="overdue">Overdue only</option>
            <option value="clear">Fully paid</option>
          </Select>
          {can('export') && rows?.length > 0 && <button type="button" className="btn btn-sm" onClick={exportCsv}>Export CSV</button>}
          {can('admit')
            ? <button type="button" className="btn btn-primary btn-sm" onClick={() => nav('/admission')}>+ Admission</button>
            : <span className="locked-note">Read-only for your role</span>}
        </>
      )}>
      {!rows ? <Loading /> : (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Adm. No</th><th>Student</th><th>Class</th><th>Father / Guardian</th><th>Contact</th>
                <th className="t-right">Net payable</th><th className="t-right">Paid</th><th className="t-right">Outstanding</th>
                <th>Status</th><th />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={10}><Empty>No student matches this filter.</Empty></td></tr>}
              {rows.map((s) => (
                <tr key={s._id} className="clickable" onClick={() => nav(`/students/${s._id}`)}>
                  <td className="mono tiny" style={{ color: 'var(--text-2)' }}>{s.admissionNo}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {s.photo ? (
                        <img src={s.photo} alt={s.name} style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--brand-soft)', color: 'var(--brand-ink)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                          {initials(s.name)}
                        </div>
                      )}
                      <div>
                        <div style={{ fontWeight: 600 }}>{s.name}</div>
                        <div className="tiny muted">
                          {s.gender === 'M' ? 'Boy' : 'Girl'} · {fmtDate(s.dob)}
                          {s.carryForward > 0 && <span style={{ color: 'var(--warn)' }}> · C/F {RS(s.carryForward)}</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td><span className="tag">{s.classId?.name}-{s.section}</span></td>
                  <td>{s.father}</td>
                  <td className="mono tiny">{s.phone}</td>
                  <td className="num">{RS(s.totals.payable)}</td>
                  <td className="num" style={{ color: 'var(--good)' }}>{RS(s.totals.paid)}</td>
                  <td className="num" style={{ fontWeight: 700, color: s.totals.outstanding ? 'var(--warn)' : 'var(--text-3)' }}>{RS(s.totals.outstanding)}</td>
                  <td>
                    {s.totals.overdue > 0 ? <Chip tone="over">Overdue</Chip>
                      : s.totals.outstanding > 0 ? <Chip tone="due">Due</Chip> : <Chip tone="paid">Clear</Chip>}
                  </td>
                  <td className="t-right">
                    {can('collect')
                      ? <button type="button" className="btn btn-sm btn-primary"
                        onClick={(e) => { e.stopPropagation(); nav(`/collect?student=${s._id}`); }}>Collect</button>
                      : <span className="tiny muted">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
