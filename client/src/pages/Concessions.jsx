import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Panel, Kpi, Chip, Loading, ErrorBox, Empty, Bar, Drawer, Confirm, Field, Input, Select } from '../components/ui';
import { RS, fmtDate, toInput, downloadCSV } from '../lib/format';

export default function Concessions() {
  const { can, user } = useAuth();
  const { toast, error: shout } = useToast();
  const nav = useNavigate();

  const [data, setData] = useState(null);
  const [reasonsList, setReasonsList] = useState([]);
  const [error, setError] = useState(null);
  const [selectedReasonFilter, setSelectedReasonFilter] = useState('');

  // Concession Drawer states
  const [creating, setCreating] = useState(false);
  const [initialReasonForCreate, setInitialReasonForCreate] = useState('');
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  // Reason Master states
  const [editingReason, setEditingReason] = useState(null); // null = closed, {} = new, obj = edit
  const [deletingReason, setDeletingReason] = useState(null);

  const canManage = can('approveDiscount') || can('collect') || user?.role === 'principal' || user?.role === 'director';

  const loadData = () => {
    setError(null);
    Promise.all([
      api.get('/concessions'),
      api.get('/concession-reasons'),
    ])
      .then(([cRes, rRes]) => {
        setData(cRes);
        setReasonsList(rRes.reasons || []);
      })
      .catch(setError);
  };

  useEffect(() => {
    document.title = 'Concession Register';
    loadData();
  }, []);

  if (error) return <ErrorBox error={error} onRetry={loadData} />;
  if (!data) return <Loading />;

  const { concessions: allRows, total, byReason, students } = data;

  // Filter rows if user selected a specific reason filter
  const rows = selectedReasonFilter
    ? allRows.filter((r) => r.reason?.trim().toLowerCase() === selectedReasonFilter.trim().toLowerCase())
    : allRows;

  const top = Object.entries(byReason).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="stack">
      {/* KPIS */}
      <div className="kpis">
        <Kpi accent label="Total concession" value={RS(total)} foot={<span>{allRows.length} total entries</span>} />
        <Kpi label="Students benefited" value={students} foot={<span>across all classes</span>} />
        <Kpi label="Reason categories" value={reasonsList.length} foot={<span>custom defined rules</span>} />
        <Kpi label="Top concession head" value={<span style={{ fontSize: 18 }}>{top?.[0] || '—'}</span>} foot={<span>{RS(top?.[1] || 0)}</span>} />
      </div>

      {/* CONCESSION REGISTER PANEL */}
      <Panel
        bodyless
        title={selectedReasonFilter ? `Concessions: "${selectedReasonFilter}"` : 'Concession & Discount Register'}
        sub={selectedReasonFilter ? `Showing ${rows.length} entries for ${selectedReasonFilter}` : 'Every discount is stored with its reason and approver — audit ready'}
        actions={(
          <div className="row" style={{ gap: 8 }}>
            {selectedReasonFilter && (
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => setSelectedReasonFilter('')}
              >
                ✕ Clear Reason Filter
              </button>
            )}
            {canManage && (
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => { setInitialReasonForCreate(''); setCreating(true); }}
              >
                + New Concession
              </button>
            )}
            {can('export') && rows.length > 0 && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => downloadCSV(
                  `concessions${selectedReasonFilter ? `_${selectedReasonFilter}` : ''}.csv`,
                  ['Date', 'Student', 'Admission No', 'Class', 'Instalment', 'Reason', 'Approved by', 'Receipt', 'Amount'],
                  rows.map((d) => [
                    fmtDate(d.date),
                    d.student?.name,
                    d.student?.admissionNo,
                    d.classId?.name,
                    d.instNo,
                    d.reason,
                    d.approvedBy?.name,
                    d.receipt?.receiptNo || '—',
                    d.amount,
                  ])
                )}
              >
                Export CSV
              </button>
            )}
          </div>
        )}
      >
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Student</th>
                <th>Class</th>
                <th>Inst.</th>
                <th>Reason</th>
                <th>Approved by</th>
                <th>Receipt</th>
                <th className="t-right">Amount</th>
                {canManage && <th className="t-right" style={{ width: 120 }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 9 : 8}>
                    <Empty>
                      {selectedReasonFilter
                        ? `No concessions found under reason "${selectedReasonFilter}".`
                        : 'No concession granted yet.'}
                    </Empty>
                  </td>
                </tr>
              )}
              {rows.map((d) => (
                <tr
                  key={d._id}
                  className="clickable"
                  onClick={() => d.student && nav(`/students/${d.student._id}`)}
                >
                  <td className="tiny nw">{fmtDate(d.date)}</td>
                  <td style={{ fontWeight: 600 }}>
                    <div>{d.student?.name || '—'}</div>
                    {d.student?.admissionNo && (
                      <div className="tiny mono muted">{d.student.admissionNo}</div>
                    )}
                  </td>
                  <td><span className="tag">{d.classId?.name}</span></td>
                  <td><b className="mono">{d.instNo}</b></td>
                  <td>
                    <Chip
                      tone="disc"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedReasonFilter(d.reason === selectedReasonFilter ? '' : d.reason);
                      }}
                      title="Click to filter by this reason"
                    >
                      {d.reason}
                    </Chip>
                  </td>
                  <td className="tiny">{d.approvedBy?.name || '—'}</td>
                  <td className="mono tiny">{d.receipt?.receiptNo || '—'}</td>
                  <td className="num" style={{ fontWeight: 700, color: 'var(--brand)' }}>{RS(d.amount)}</td>
                  {canManage && (
                    <td className="t-right nw" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{ padding: '3px 8px', fontSize: 11.5, marginRight: 6 }}
                        onClick={() => setEditing(d)}
                        title="Edit Concession"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        style={{ color: 'var(--crit)', padding: '3px 8px', fontSize: 11.5 }}
                        onClick={() => setDeleting(d)}
                        title="Delete Concession"
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--surface-2)' }}>
                <td colSpan={7} style={{ fontWeight: 700 }}>
                  {selectedReasonFilter ? `Subtotal (${selectedReasonFilter})` : 'Total'}
                </td>
                <td className="num" style={{ fontWeight: 700 }}>
                  {RS(rows.reduce((acc, r) => acc + (r.amount || 0), 0))}
                </td>
                {canManage && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      </Panel>

      {/* REASON-WISE CONCESSIONS (REASON MASTER & BREAKDOWN) */}
      <Panel
        title="Reason-wise Concessions"
        sub="Manage concession categories, set default discount amounts, and track category waivers"
        actions={canManage && (
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => setEditingReason({})}
          >
            + New Reason
          </button>
        )}
      >
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 14
        }}>
          {reasonsList.map((r) => {
            const isSelected = selectedReasonFilter.toLowerCase() === r.name.toLowerCase();
            const pct = total > 0 ? (r.totalGranted / total) * 100 : 0;
            return (
              <div
                key={r._id}
                style={{
                  background: isSelected ? 'var(--brand-soft)' : 'var(--surface-2)',
                  border: isSelected ? '1px solid var(--brand)' : '1px solid var(--line)',
                  borderRadius: 10,
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 10,
                  transition: 'all 0.15s ease',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <b style={{ fontSize: 14.5, color: isSelected ? 'var(--brand)' : 'var(--text)' }}>
                      {r.name}
                    </b>
                    {r.defaultAmount > 0 ? (
                      <span className="chip" style={{ background: 'rgba(224, 70, 128, 0.12)', color: 'var(--brand)', fontSize: 11, fontWeight: 700 }}>
                        Def: {RS(r.defaultAmount)}
                      </span>
                    ) : (
                      <span className="tiny muted" style={{ fontSize: 10.5 }}>Custom amt</span>
                    )}
                  </div>

                  {r.description && (
                    <div className="tiny muted" style={{ marginTop: 4, lineHeight: 1.4 }}>
                      {r.description}
                    </div>
                  )}

                  <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div>
                      <div className="tiny muted">Granted Total</div>
                      <div className="mono" style={{ fontSize: 17, fontWeight: 700 }}>
                        {RS(r.totalGranted)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="tiny muted">Entries</div>
                      <div className="mono" style={{ fontWeight: 600 }}>{r.usageCount}</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <Bar pct={pct} color="var(--brand)" />
                  </div>
                </div>

                {/* Quick actions for this reason */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: 8,
                  borderTop: '1px solid var(--line-2)',
                  marginTop: 4
                }}>
                  <div className="row" style={{ gap: 6 }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ padding: '2px 8px', fontSize: 11 }}
                      onClick={() => setSelectedReasonFilter(isSelected ? '' : r.name)}
                    >
                      {isSelected ? 'Filtered ✓' : 'Filter View'}
                    </button>
                    {canManage && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{ padding: '2px 8px', fontSize: 11 }}
                        onClick={() => {
                          setInitialReasonForCreate(r.name);
                          setCreating(true);
                        }}
                        title={`Grant concession for ${r.name}`}
                      >
                        + Grant
                      </button>
                    )}
                  </div>

                  {canManage && (
                    <div className="row" style={{ gap: 4 }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        style={{ padding: '2px 6px', fontSize: 11 }}
                        onClick={() => setEditingReason(r)}
                        title="Edit Reason"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        style={{ color: 'var(--crit)', padding: '2px 6px', fontSize: 11 }}
                        onClick={() => setDeletingReason(r)}
                        title="Delete Reason"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* CREATE CONCESSION DRAWER */}
      {creating && (
        <CreateConcessionDrawer
          initialReason={initialReasonForCreate}
          reasonsList={reasonsList}
          onOpenNewReason={() => setEditingReason({})}
          onClose={() => setCreating(false)}
          onSuccess={() => {
            setCreating(false);
            loadData();
            toast('Concession created successfully!');
          }}
        />
      )}

      {/* EDIT CONCESSION DRAWER */}
      {editing && (
        <EditConcessionDrawer
          concession={editing}
          reasonsList={reasonsList}
          onClose={() => setEditing(null)}
          onSuccess={() => {
            setEditing(null);
            loadData();
            toast('Concession updated successfully!');
          }}
        />
      )}

      {/* DELETE CONCESSION CONFIRM */}
      {deleting && (
        <DeleteConcessionConfirm
          concession={deleting}
          onClose={() => setDeleting(null)}
          onSuccess={() => {
            setDeleting(null);
            loadData();
            toast('Concession deleted and ledger restored!');
          }}
        />
      )}

      {/* REASON FORM DRAWER (CREATE / EDIT REASON) */}
      {editingReason && (
        <ReasonFormDrawer
          reason={editingReason}
          onClose={() => setEditingReason(null)}
          onSuccess={() => {
            setEditingReason(null);
            loadData();
            toast(editingReason._id ? 'Reason updated!' : 'New reason created!');
          }}
        />
      )}

      {/* DELETE REASON CONFIRM */}
      {deletingReason && (
        <DeleteReasonConfirm
          reason={deletingReason}
          onClose={() => setDeletingReason(null)}
          onSuccess={() => {
            setDeletingReason(null);
            loadData();
            toast('Reason deleted successfully!');
          }}
        />
      )}
    </div>
  );
}

/** -------------------------------------------------------------
 * CREATE CONCESSION DRAWER COMPONENT
 * ------------------------------------------------------------- */
function CreateConcessionDrawer({ initialReason, reasonsList, onOpenNewReason, onClose, onSuccess }) {
  const { error: shout } = useToast();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);

  const [loadingLedger, setLoadingLedger] = useState(false);
  const [ledgerRows, setLedgerRows] = useState([]);
  const [selectedInstNo, setSelectedInstNo] = useState('');

  const [amount, setAmount] = useState('');
  const [selectedReason, setSelectedReason] = useState(initialReason || reasonsList[0]?.name || '');
  const [customReason, setCustomReason] = useState('');
  const [date, setDate] = useState(toInput(new Date()));
  const [saving, setSaving] = useState(false);

  const searchTimer = useRef(null);

  // Initial student suggestions
  useEffect(() => {
    api.get('/students?limit=8')
      .then((res) => setSearchResults(res.students || []))
      .catch(() => {});
  }, []);

  // When reason changes, auto-populate default amount if set
  const onReasonChange = (val) => {
    setSelectedReason(val);
    const matched = reasonsList.find((r) => r.name === val);
    if (matched && matched.defaultAmount > 0) {
      setAmount(String(matched.defaultAmount));
    }
  };

  // Set initial default amount if reason was pre-selected
  useEffect(() => {
    if (initialReason) {
      const matched = reasonsList.find((r) => r.name === initialReason);
      if (matched && matched.defaultAmount > 0) {
        setAmount(String(matched.defaultAmount));
      }
    }
  }, [initialReason, reasonsList]);

  // Debounced student search
  const onSearchChange = (val) => {
    setQuery(val);
    clearTimeout(searchTimer.current);
    if (!val.trim()) {
      api.get('/students?limit=8').then((res) => setSearchResults(res.students || []));
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await api.get(`/students?search=${encodeURIComponent(val.trim())}&limit=12`);
        setSearchResults(res.students || []);
      } catch (e) {
        shout(e);
      } finally {
        setSearching(false);
      }
    }, 280);
  };

  // When a student is selected, fetch their ledger installments
  const chooseStudent = async (student) => {
    setSelectedStudent(student);
    setLoadingLedger(true);
    try {
      const res = await api.get(`/students/${student._id}`);
      const rows = res.ledger || [];
      setLedgerRows(rows);

      // Select first installment with positive balance
      const firstDue = rows.find((l) => l.balance > 0) || rows[0];
      if (firstDue) {
        setSelectedInstNo(firstDue.instNo);
        // Only override amount if not already filled by default amount
        if (!amount) {
          setAmount(firstDue.balance > 0 ? String(Math.min(500, firstDue.balance)) : '');
        }
      }
    } catch (e) {
      shout(e);
    } finally {
      setLoadingLedger(false);
    }
  };

  const currentLedger = ledgerRows.find((l) => l.instNo === selectedInstNo);
  const maxAllowed = currentLedger ? currentLedger.balance : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStudent) {
      shout('Please select a student first.');
      return;
    }
    if (!currentLedger) {
      shout('Please select a valid fee instalment.');
      return;
    }
    const num = Number(amount);
    if (!num || num <= 0) {
      shout('Please enter a valid concession amount.');
      return;
    }
    if (num > maxAllowed) {
      shout(`Concession cannot exceed the remaining balance of ₹${maxAllowed} on Instalment ${selectedInstNo}.`);
      return;
    }
    const finalReason = selectedReason === '__custom__' ? customReason.trim() : selectedReason;
    if (!finalReason) {
      shout('Please specify the reason for the concession.');
      return;
    }

    setSaving(true);
    try {
      await api.post('/concessions', {
        studentId: selectedStudent._id,
        ledgerId: currentLedger._id,
        instNo: currentLedger.instNo,
        amount: num,
        reason: finalReason,
        date,
      });
      onSuccess();
    } catch (err) {
      shout(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      title="Grant Concession"
      sub="New Concession"
      onClose={onClose}
      wide
      footer={(
        <>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={saving || !selectedStudent || !currentLedger || !Number(amount)}
          >
            {saving ? 'Applying…' : 'Apply Concession'}
          </button>
          <div style={{ flex: 1 }} />
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
        </>
      )}
    >
      <div className="stack" style={{ gap: 18 }}>
        {/* Step 1: Student Selection */}
        {!selectedStudent ? (
          <div>
            <div className="lbl" style={{ marginBottom: 8 }}>1. Select Student</div>
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <Input
                type="search"
                placeholder="Search by student name, admission no, or phone..."
                value={query}
                onChange={(e) => onSearchChange(e.target.value)}
                autoFocus
              />
              {searching && (
                <div style={{ position: 'absolute', right: 10, top: 10 }} className="tiny muted">
                  Searching…
                </div>
              )}
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 10,
              maxHeight: 320,
              overflowY: 'auto',
              padding: 2
            }}>
              {searchResults.length === 0 && (
                <div className="tiny muted" style={{ padding: 12 }}>
                  {query ? 'No student found matching query.' : 'No students found.'}
                </div>
              )}
              {searchResults.map((s) => (
                <div
                  key={s._id}
                  onClick={() => chooseStudent(s)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: 'var(--surface-2)',
                    border: '1px solid var(--line)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--brand)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--line)'; }}
                >
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{s.name}</div>
                  <div className="row" style={{ gap: 6, marginTop: 4 }}>
                    <span className="chip" style={{ fontSize: 10, padding: '1px 6px' }}>{s.classId?.name}</span>
                    <span className="mono tiny muted">{s.admissionNo}</span>
                  </div>
                  {s.father && <div className="tiny muted" style={{ marginTop: 2 }}>Father: {s.father}</div>}
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Student Selected Card */
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div className="lbl">Selected Student</div>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => { setSelectedStudent(null); setLedgerRows([]); }}
              >
                Change Student
              </button>
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderRadius: 8, background: 'var(--surface-2)',
              border: '1px solid var(--brand-line)', flexWrap: 'wrap', gap: 10
            }}>
              <div>
                <b style={{ fontSize: 15 }}>{selectedStudent.name}</b>
                <div className="row" style={{ gap: 8, marginTop: 3 }}>
                  <span className="chip" style={{ fontSize: 11 }}>{selectedStudent.classId?.name}</span>
                  <span className="mono tiny muted">Adm: {selectedStudent.admissionNo}</span>
                  {selectedStudent.father && <span className="tiny muted">· Father: {selectedStudent.father}</span>}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="tiny muted">Outstanding Fee</div>
                <div className="mono" style={{ fontWeight: 700, fontSize: 16, color: 'var(--warn)' }}>
                  {RS(selectedStudent.totals?.outstanding || 0)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Instalment & Amount Configuration */}
        {selectedStudent && (
          loadingLedger ? (
            <div className="tiny muted" style={{ padding: 20, textAlign: 'center' }}>Loading student fee instalments…</div>
          ) : (
            <div className="stack" style={{ gap: 16 }}>
              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {/* Instalment Selection */}
                <Field label="Apply to Instalment *">
                  <Select value={selectedInstNo} onChange={(e) => setSelectedInstNo(e.target.value)}>
                    {ledgerRows.map((l) => (
                      <option key={l.instNo} value={l.instNo}>
                        Instalment {l.instNo} ({l.month}) — Bal: {RS(l.balance)} {l.balance <= 0 ? '✓ (Paid)' : ''}
                      </option>
                    ))}
                  </Select>
                </Field>

                {/* Date */}
                <Field label="Concession Date *">
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </Field>
              </div>

              {/* Selected Instalment Overview Banner */}
              {currentLedger && (
                <div style={{
                  padding: '10px 14px', borderRadius: 8, background: 'var(--surface-3)',
                  border: '1px solid var(--line)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10
                }}>
                  <div>
                    <div className="tiny muted">Gross Fee</div>
                    <b className="mono">{RS(currentLedger.gross)}</b>
                  </div>
                  <div>
                    <div className="tiny muted">Already Paid</div>
                    <b className="mono">{RS(currentLedger.paid)}</b>
                  </div>
                  <div>
                    <div className="tiny muted">Prior Concession</div>
                    <b className="mono" style={{ color: 'var(--brand)' }}>{RS(currentLedger.discount)}</b>
                  </div>
                  <div>
                    <div className="tiny muted">Remaining Balance</div>
                    <b className="mono" style={{ color: maxAllowed > 0 ? 'var(--warn)' : 'var(--good)', fontSize: 14 }}>
                      {RS(maxAllowed)}
                    </b>
                  </div>
                </div>
              )}

              {/* Amount Field */}
              <div>
                <Field label={`Concession Amount (₹) * (Max: ${RS(maxAllowed)})`}>
                  <Input
                    className="input num"
                    type="number"
                    min="1"
                    max={maxAllowed}
                    placeholder="Enter amount..."
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    style={{ fontSize: 16, fontWeight: 700 }}
                  />
                </Field>
                {/* Quick Presets */}
                {maxAllowed > 0 && (
                  <div className="row" style={{ gap: 6, marginTop: 8 }}>
                    <span className="tiny muted">Quick:</span>
                    {[200, 500, 1000, 2000].filter((v) => v <= maxAllowed).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className="btn btn-sm"
                        style={{ padding: '2px 8px', fontSize: 11 }}
                        onClick={() => setAmount(String(preset))}
                      >
                        ₹{preset}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ padding: '2px 8px', fontSize: 11, color: 'var(--brand)' }}
                      onClick={() => setAmount(String(maxAllowed))}
                    >
                      Full Balance ({RS(maxAllowed)})
                    </button>
                  </div>
                )}
                {Number(amount) > maxAllowed && (
                  <div className="err" style={{ marginTop: 4 }}>
                    Concession amount cannot exceed the remaining balance of {RS(maxAllowed)}.
                  </div>
                )}
              </div>

              {/* Reason Field */}
              <div className="grid" style={{ gridTemplateColumns: selectedReason === '__custom__' ? '1fr 1fr' : '1fr', gap: 14 }}>
                <Field label={(
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Concession Reason *</span>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      style={{ fontSize: 11, padding: '0 4px', color: 'var(--brand)' }}
                      onClick={onOpenNewReason}
                    >
                      + Add New Reason
                    </button>
                  </div>
                )}>
                  <Select value={selectedReason} onChange={(e) => onReasonChange(e.target.value)}>
                    {reasonsList.map((r) => (
                      <option key={r._id} value={r.name}>
                        {r.name} {r.defaultAmount > 0 ? `(Default: ₹${r.defaultAmount})` : ''}
                      </option>
                    ))}
                    <option value="__custom__">+ Other / Custom Reason</option>
                  </Select>
                </Field>

                {selectedReason === '__custom__' && (
                  <Field label="Specify Custom Reason *">
                    <Input
                      placeholder="e.g. Approved by Director for scholarship"
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      autoFocus
                    />
                  </Field>
                )}
              </div>
            </div>
          )
        )}
      </div>
    </Drawer>
  );
}

/** -------------------------------------------------------------
 * EDIT CONCESSION DRAWER COMPONENT
 * ------------------------------------------------------------- */
function EditConcessionDrawer({ concession, reasonsList, onClose, onSuccess }) {
  const { error: shout } = useToast();
  const [amount, setAmount] = useState(String(concession.amount || ''));
  const isPreset = reasonsList.some((r) => r.name.toLowerCase() === (concession.reason || '').toLowerCase());
  const [category, setCategory] = useState(isPreset ? concession.reason : '__custom__');
  const [customReason, setCustomReason] = useState(isPreset ? '' : concession.reason);
  const [date, setDate] = useState(toInput(concession.date));
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const num = Number(amount);
    if (!num || num <= 0) {
      shout('Please enter a valid concession amount.');
      return;
    }
    const finalReason = category === '__custom__' ? customReason.trim() : category;
    if (!finalReason) {
      shout('Please provide a reason.');
      return;
    }

    setSaving(true);
    try {
      await api.patch(`/concessions/${concession._id}`, {
        amount: num,
        reason: finalReason,
        date,
      });
      onSuccess();
    } catch (err) {
      shout(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      title="Edit Concession"
      sub={`Instalment ${concession.instNo} · ${concession.student?.name || 'Student'}`}
      onClose={onClose}
      footer={(
        <>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={saving || !Number(amount)}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <div style={{ flex: 1 }} />
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
        </>
      )}
    >
      <div className="stack" style={{ gap: 16 }}>
        {/* Info Card */}
        <div style={{
          padding: '12px 14px', borderRadius: 8, background: 'var(--surface-2)',
          border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 6
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600 }}>{concession.student?.name}</span>
            <span className="chip">{concession.classId?.name}</span>
          </div>
          <div className="row" style={{ gap: 10, fontSize: 12 }}>
            <span className="mono muted">Adm: {concession.student?.admissionNo}</span>
            <span className="muted">· Instalment: <b className="mono">{concession.instNo}</b></span>
            {concession.receipt?.receiptNo && (
              <span className="mono" style={{ color: 'var(--teal)' }}>
                Receipt: {concession.receipt.receiptNo}
              </span>
            )}
          </div>
        </div>

        {/* Amount */}
        <Field label="Concession Amount (₹) *">
          <Input
            className="input num"
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ fontSize: 16, fontWeight: 700 }}
          />
        </Field>

        {/* Reason */}
        <Field label="Concession Reason *">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {reasonsList.map((r) => (
              <option key={r._id} value={r.name}>{r.name}</option>
            ))}
            <option value="__custom__">+ Other / Custom Reason</option>
          </Select>
        </Field>

        {category === '__custom__' && (
          <Field label="Custom Reason Explanation *">
            <Input
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Explain reason..."
            />
          </Field>
        )}

        {/* Date */}
        <Field label="Date *">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>

        <p className="tiny muted" style={{ margin: 0 }}>
          Modifying this amount will automatically update the student&apos;s ledger discount and recompute their outstanding balance.
        </p>
      </div>
    </Drawer>
  );
}

/** -------------------------------------------------------------
 * DELETE CONCESSION CONFIRMATION COMPONENT
 * ------------------------------------------------------------- */
function DeleteConcessionConfirm({ concession, onClose, onSuccess }) {
  const { error: shout } = useToast();
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await api.delete(`/concessions/${concession._id}`);
      onSuccess();
    } catch (err) {
      shout(err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Confirm
      title="Delete Concession?"
      danger="Yes, Delete Concession"
      loading={deleting}
      onOk={handleConfirm}
      onClose={onClose}
    >
      <div className="stack" style={{ gap: 12 }}>
        <p style={{ margin: 0 }}>
          Are you sure you want to delete the concession of <b style={{ color: 'var(--brand)' }}>{RS(concession.amount)}</b> for{' '}
          <b>{concession.student?.name}</b> (Instalment <b>{concession.instNo}</b>)?
        </p>

        <div style={{
          padding: '10px 14px', borderRadius: 8, background: 'var(--surface-2)',
          border: '1px solid var(--line)', fontSize: 12.5
        }}>
          <div><b>Reason:</b> {concession.reason}</div>
          <div style={{ marginTop: 3 }}><b>Granted On:</b> {fmtDate(concession.date)}</div>
          {concession.approvedBy?.name && (
            <div style={{ marginTop: 3 }}><b>Approved By:</b> {concession.approvedBy.name}</div>
          )}
          {concession.receipt?.receiptNo && (
            <div style={{ marginTop: 3, color: 'var(--warn)' }}>
              <b>Note:</b> This concession is tied to Receipt #{concession.receipt.receiptNo}.
            </div>
          )}
        </div>

        <div style={{
          padding: '10px 14px', borderRadius: 8, background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.25)', fontSize: 12, color: 'var(--crit)'
        }}>
          ⚠️ <b>Ledger Impact:</b> The discount will be reversed from Instalment {concession.instNo}, and the student&apos;s outstanding balance will increase by {RS(concession.amount)}.
        </div>
      </div>
    </Confirm>
  );
}

/** -------------------------------------------------------------
 * REASON FORM DRAWER (CREATE / EDIT CONCESSION REASON)
 * ------------------------------------------------------------- */
function ReasonFormDrawer({ reason, onClose, onSuccess }) {
  const { error: shout } = useToast();
  const [name, setName] = useState(reason?.name || '');
  const [defaultAmount, setDefaultAmount] = useState(reason?.defaultAmount ? String(reason.defaultAmount) : '');
  const [description, setDescription] = useState(reason?.description || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      shout('Please enter a reason name.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: trimmed,
        defaultAmount: Math.max(0, Number(defaultAmount) || 0),
        description: description.trim(),
      };

      if (reason?._id) {
        await api.patch(`/concession-reasons/${reason._id}`, payload);
      } else {
        await api.post('/concession-reasons', payload);
      }
      onSuccess();
    } catch (err) {
      shout(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      title={reason?._id ? `Edit Reason: ${reason.name}` : 'Add Concession Reason'}
      sub="Concession Reason Master"
      onClose={onClose}
      footer={(
        <>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={saving || !name.trim()}
          >
            {saving ? 'Saving…' : (reason?._id ? 'Save Changes' : 'Create Reason')}
          </button>
          <div style={{ flex: 1 }} />
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
        </>
      )}
    >
      <div className="stack" style={{ gap: 16 }}>
        <Field label="Reason Name *">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sibling Concession, Sports Quota, Staff Child"
            autoFocus
          />
        </Field>

        <Field label="Default Concession Amount (₹)">
          <Input
            className="input num"
            type="number"
            min="0"
            value={defaultAmount}
            onChange={(e) => setDefaultAmount(e.target.value)}
            placeholder="e.g. 500 (optional)"
          />
        </Field>
        <div className="tiny muted" style={{ marginTop: -10 }}>
          When this reason is selected during fee collection or concession entry, this amount will be automatically pre-filled.
        </div>

        <Field label="Description / Eligibility">
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. For second child studying concurrently"
          />
        </Field>
      </div>
    </Drawer>
  );
}

/** -------------------------------------------------------------
 * DELETE REASON CONFIRMATION COMPONENT
 * ------------------------------------------------------------- */
function DeleteReasonConfirm({ reason, onClose, onSuccess }) {
  const { error: shout } = useToast();
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await api.delete(`/concession-reasons/${reason._id}`);
      onSuccess();
    } catch (err) {
      shout(err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Confirm
      title="Delete Concession Reason?"
      danger="Delete Reason"
      loading={deleting}
      onOk={handleConfirm}
      onClose={onClose}
    >
      <div className="stack" style={{ gap: 12 }}>
        <p style={{ margin: 0 }}>
          Are you sure you want to delete the concession reason <b>&quot;{reason.name}&quot;</b>?
        </p>

        {reason.usageCount > 0 && (
          <div style={{
            padding: '10px 14px', borderRadius: 8, background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)', fontSize: 12, color: 'var(--warn)'
          }}>
            ℹ️ <b>Note:</b> This reason is currently recorded on <b>{reason.usageCount}</b> existing concessions totaling {RS(reason.totalGranted)}. Past concessions will retain their recorded reason text.
          </div>
        )}
      </div>
    </Confirm>
  );
}
