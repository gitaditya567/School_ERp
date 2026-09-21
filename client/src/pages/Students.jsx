import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { cachedGet } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Panel, Chip, Loading, ErrorBox, Empty, Input, Select, Confirm } from '../components/ui';
import { RS, fmtDate, downloadCSV, initials } from '../lib/format';
import StudentDocumentModal from '../components/StudentDocumentModal';

export default function Students() {
  const { can, user } = useAuth();
  const { toast, error: shout } = useToast();
  const nav = useNavigate();
  const [rows, setRows] = useState(null);
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState(null);
  const [f, setF] = useState({ search: '', classId: '', status: '' });
  const [studentToDelete, setStudentToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedDocStudent, setSelectedDocStudent] = useState(null);

  useEffect(() => {
    document.title = 'Student Directory';
    cachedGet('/classes').then((d) => setClasses(d.classes)).catch(() => {});
  }, []);

  const load = () => {
    setError(null);
    api.get('/students', { params: f }).then((d) => setRows(d.students)).catch(setError);
  };

  useEffect(() => {
    // Only debounce when user is typing, initial load should be immediate
    const delay = f.search ? 220 : 0;
    const id = setTimeout(() => {
      load();
    }, delay);
    return () => clearTimeout(id);
  }, [f.search, f.classId, f.status]);

  const handleDelete = async () => {
    if (!studentToDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/students/${studentToDelete._id}?force=true`);
      toast(`${studentToDelete.name} deleted successfully`);
      setStudentToDelete(null);
      load();
    } catch (e) {
      shout(e);
    } finally {
      setDeleting(false);
    }
  };

  if (error) return <ErrorBox error={error} onRetry={() => setF({ ...f })} />;

  const exportCsv = () => downloadCSV('students.csv',
    ['Adm No', 'Name', 'Class', 'Father', 'Mother', 'Phone', 'Alt Phone', 'Address', 'Documents Status', 'Birth Cert', 'Father Aadhaar', 'Mother Aadhaar'],
    rows.map((s) => {
      const count = (s.birthCertificateSubmitted ? 1 : 0) + (s.fatherAadhaarSubmitted ? 1 : 0) + (s.motherAadhaarSubmitted ? 1 : 0);
      return [
        s.admissionNo, s.name, s.classId?.name, s.father, s.mother || '', s.phone, s.alternatePhone || '', s.address || '',
        count === 3 ? 'Submitted (3/3)' : `Pending (${count}/3)`,
        s.birthCertificateSubmitted ? 'Submitted' : 'Pending',
        s.fatherAadhaarSubmitted ? 'Submitted' : 'Pending',
        s.motherAadhaarSubmitted ? 'Submitted' : 'Pending',
      ];
    }));

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
                <th>Adm. No</th><th>Student</th><th>Class</th><th>Father / Guardian</th><th>Mother Name</th><th>Contact</th><th>Address</th><th>Documents</th><th />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={9}><Empty>No student matches this filter.</Empty></td></tr>}
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
                  <td>{s.mother || <span className="muted">—</span>}</td>
                  <td className="mono tiny">
                    <div>{s.phone}</div>
                    {s.alternatePhone && <div className="muted" style={{ fontSize: 11 }}>{s.alternatePhone}</div>}
                  </td>
                  <td style={{ maxWidth: 200, whiteSpace: 'normal', wordBreak: 'break-word', fontSize: 12.5 }} title={s.address}>
                    {s.address || <span className="muted">—</span>}
                  </td>
                  <td onClick={(e) => { e.stopPropagation(); setSelectedDocStudent(s); }}>
                    {(() => {
                      const count = (s.birthCertificateSubmitted ? 1 : 0) + (s.fatherAadhaarSubmitted ? 1 : 0) + (s.motherAadhaarSubmitted ? 1 : 0);
                      const all = count === 3;
                      return (
                        <div style={{ cursor: 'pointer', display: 'inline-block' }} title="Click to view & upload documents">
                          {all ? (
                            <Chip tone="paid">Submitted (3/3)</Chip>
                          ) : (
                            <Chip tone="due">Pending ({count}/3)</Chip>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="t-right" onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
                      {can('collect') && (
                        <button type="button" className="btn btn-sm btn-primary"
                          onClick={() => nav(`/collect?student=${s._id}`)}>Collect</button>
                      )}
                      {can('admit') && (
                        <button type="button" className="btn btn-sm"
                          style={{ color: 'var(--crit)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                          title="Delete Student"
                          onClick={() => setStudentToDelete(s)}>Delete</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {studentToDelete && (
        <Confirm
          title={`Delete ${studentToDelete.name}?`}
          danger="Delete Student"
          loading={deleting}
          onClose={() => !deleting && setStudentToDelete(null)}
          onOk={handleDelete}
        >
          <p style={{ margin: '0 0 12px', fontSize: 14 }}>
            Are you sure you want to permanently delete <strong>{studentToDelete.name}</strong> (Admission No: <span className="mono">{studentToDelete.admissionNo}</span>)?
          </p>
          <div style={{ padding: '12px 14px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 8, color: 'var(--crit)', fontSize: 13, lineHeight: 1.5 }}>
            <strong>Warning:</strong> This will permanently remove the student profile, all fee ledgers, concessions, and associated payment receipts. This action cannot be undone.
          </div>
        </Confirm>
      )}
      {selectedDocStudent && (
        <StudentDocumentModal
          student={selectedDocStudent}
          onClose={() => setSelectedDocStudent(null)}
          onSaved={() => {
            load();
            setSelectedDocStudent(null);
          }}
        />
      )}
    </Panel>
  );
}
