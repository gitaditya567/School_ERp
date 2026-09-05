import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Panel, Chip, Drawer, Field, Input, Select, Loading, ErrorBox, Empty } from '../components/ui';
import { RS, RS0, fmtDate, monthName } from '../lib/format';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (d) => (d ? `${MON[new Date(d).getMonth()]} ${new Date(d).getFullYear()}` : '');
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

export default function FeeMaster() {
  const { can } = useAuth();
  const { toast, error: shout } = useToast();
  const edit = can('editFeeMaster');

  const [classes, setClasses] = useState(null);
  const [heads, setHeads] = useState([]);
  const [active, setActive] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null); // {type, payload}

  const loadAll = async () => {
    setError(null);
    try {
      const [c, h] = await Promise.all([api.get('/classes'), api.get('/fee-heads')]);
      setClasses(c.classes); setHeads(h.heads);
      const id = active && c.classes.some((x) => x.id === active) ? active : c.classes[0]?.id || null;
      setActive(id);
      if (id) setDetail(await api.get(`/classes/${id}`));
      else setDetail(null);
    } catch (e) { setError(e); }
  };
  useEffect(() => { document.title = 'Fee Master'; loadAll(); }, []);
  useEffect(() => { if (active) api.get(`/classes/${active}`).then(setDetail).catch(shout); }, [active]);

  const klass = detail?.class;
  const collected = detail?.collected || {};
  const headTotals = useMemo(() => {
    const m = {};
    (klass?.plan || []).forEach((p) => p.parts.forEach((x) => {
      const id = x.head?._id || x.head;
      m[id] = (m[id] || 0) + x.amount;
    }));
    return m;
  }, [klass]);

  if (error) return <ErrorBox error={error} onRetry={loadAll} />;
  if (!classes) return <Loading />;

  const run = async (fn, okMsg) => {
    try {
      const res = await fn();
      setModal(null);
      await loadAll();
      const sync = res?.sync?.students ? ` · ${res.sync.students} student ledger${res.sync.students > 1 ? 's' : ''} updated` : '';
      toast((res?.message || okMsg) + sync);
    } catch (e) { shout(e); }
  };

  return (
    <div className="stack">
      <Panel bodyless title="Fee Master" sub="Create classes, build their instalment plan, and edit or remove any part of it"
        actions={(
          <>
            <div className="seg">
              {classes.map((c) => (
                <button key={c.id} type="button" aria-pressed={c.id === active} onClick={() => setActive(c.id)}>{c.name}</button>
              ))}
            </div>
            {edit ? <button type="button" className="btn btn-sm btn-primary" onClick={() => setModal({ type: 'class' })}>+ Class</button>
              : <span className="locked-note">Read-only — only the Principal can edit the fee master</span>}
          </>
        )}>
        {!klass ? <Empty>No class yet — create the first one to start the fee master.</Empty> : (
          <>
            <div className="panel-body" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid var(--line)' }}>
              <Chip tone={klass.status === 'verified' ? 'paid' : 'due'}>{klass.status === 'verified' ? 'Verified — locked' : 'Draft'}</Chip>
              <span className="tiny muted">
                {klass.source || '—'} · {detail.students} student{detail.students === 1 ? '' : 's'} · {klass.plan.length} instalment{klass.plan.length === 1 ? '' : 's'}
              </span>
              {edit && (
                <>
                  <button type="button" className="btn btn-sm" onClick={() => setModal({ type: 'class', payload: klass })}>Edit class</button>
                  <button type="button" className="btn btn-sm" style={{ color: 'var(--crit)' }} onClick={() => setModal({ type: 'delClass' })}>Delete class</button>
                </>
              )}
              <div style={{ flex: 1 }} />
              {Object.entries(headTotals).map(([id, v]) => (
                <span key={id} className="tag">{heads.find((h) => h._id === id)?.name || 'Head'}: <b className="mono">{RS0(v)}</b></span>
              ))}
            </div>

            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr><th>Inst.</th><th>Due month</th><th>Due date</th><th>Fee particulars</th>
                    <th className="t-right">Break-up</th><th className="t-right">Total</th><th>Collected</th>{edit && <th className="t-right">Actions</th>}</tr>
                </thead>
                <tbody>
                  {klass.plan.length === 0 && <tr><td colSpan={edit ? 8 : 7}><Empty>No instalment yet — add the first one to build {klass.name}’s fee plan.</Empty></td></tr>}
                  {klass.plan.map((p) => {
                    const pc = collected[p.no] || 0;
                    const total = p.parts.reduce((s, x) => s + x.amount, 0);
                    return (
                      <tr key={p._id}>
                        <td><b className="mono">{p.no}</b></td>
                        <td className="nw">{p.month}</td>
                        <td className="tiny mono nw">{fmtDate(p.dueDate)}</td>
                        <td className="tiny muted">{[...new Set(p.parts.map((x) => x.head?.name || 'Head'))].join(' + ')}</td>
                        <td className="num tiny muted nw">{p.parts.map((x) => RS0(x.amount)).join(' + ')}</td>
                        <td className="num" style={{ fontWeight: 700 }}>{RS(total)}</td>
                        <td>{pc ? <Chip tone="paid">{pc} paid</Chip> : <Chip tone="up">none yet</Chip>}</td>
                        {edit && (
                          <td className="t-right nw">
                            <button type="button" className="btn btn-sm" onClick={() => setModal({ type: 'inst', payload: p })}>Edit</button>
                            <button type="button" className="btn btn-sm btn-ghost" style={{ color: pc ? 'var(--text-3)' : 'var(--crit)' }}
                              title={pc ? 'Already collected — cannot delete' : ''}
                              onClick={() => (pc ? toast(`Cannot delete — instalment ${p.no} is already collected from ${pc} student(s)`) : setModal({ type: 'delInst', payload: p }))}>Delete</button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--surface-2)' }}>
                    <td colSpan={5} style={{ fontWeight: 700 }}>Session total ({klass.name})</td>
                    <td className="num" style={{ fontWeight: 700, fontSize: 15 }}>{RS(klass.sessionTotal)}</td>
                    <td colSpan={edit ? 2 : 1} />
                  </tr>
                </tfoot>
              </table>
            </div>

            {edit && (
              <div className="panel-body" style={{ borderTop: '1px solid var(--line)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'inst' })}>+ Add instalment</button>
                {classes.length > 1 && <button type="button" className="btn btn-sm" onClick={() => setModal({ type: 'copy' })}>Copy plan from another class</button>}
                <div style={{ flex: 1 }} />
                <span className="tiny muted">Edits reach every unpaid ledger row straight away · paid rows and issued receipts are never rewritten</span>
              </div>
            )}
          </>
        )}
      </Panel>

      <Panel bodyless title="Fee heads" sub="The building blocks every instalment is made of"
        actions={edit && <button type="button" className="btn btn-sm btn-primary" onClick={() => setModal({ type: 'head' })}>+ Head</button>}>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Head</th><th>Code</th><th>Type</th><th className="t-right">In {klass?.name || 'class'}</th><th>Used by</th>{edit && <th className="t-right">Actions</th>}</tr></thead>
            <tbody>
              {heads.length === 0 && <tr><td colSpan={6}><Empty>No fee head yet. Run the seed script or add them here.</Empty></td></tr>}
              {heads.map((h) => (
                <tr key={h._id}>
                  <td style={{ fontWeight: 600 }}>{h.name}</td>
                  <td className="mono tiny">{h.code}</td>
                  <td><span className="tag">{h.type}</span></td>
                  <td className="num">{headTotals[h._id] ? RS(headTotals[h._id]) : '—'}</td>
                  <td className="tiny muted">{h.usedBy.length ? h.usedBy.join(', ') : 'not used'}</td>
                  {edit && (
                    <td className="t-right nw">
                      <button type="button" className="btn btn-sm" onClick={() => setModal({ type: 'head', payload: h })}>Edit</button>
                      <button type="button" className="btn btn-sm btn-ghost" style={{ color: h.usedBy.length ? 'var(--text-3)' : 'var(--crit)' }}
                        onClick={() => run(() => api.delete(`/fee-heads/${h._id}`), 'Fee head deleted')}>Delete</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {modal?.type === 'class' && <ClassForm existing={modal.payload} classes={classes} onClose={() => setModal(null)}
        onSave={(body) => run(() => (modal.payload ? api.patch(`/classes/${modal.payload.id}`, body) : api.post('/classes', body)),
          modal.payload ? 'Class updated' : 'Class created')} />}

      {modal?.type === 'delClass' && (
        <Confirm title={`Delete ${klass.name}?`} danger="Delete class" onClose={() => setModal(null)}
          onOk={() => run(() => api.delete(`/classes/${klass.id}`), 'Class deleted')}>
          <p style={{ margin: '0 0 8px' }}>This removes the class and its {klass.plan.length}-instalment fee plan.</p>
          <p className="tiny muted" style={{ margin: 0 }}>The server refuses if any student is still enrolled. This cannot be undone.</p>
        </Confirm>
      )}

      {modal?.type === 'inst' && <InstForm existing={modal.payload} heads={heads} plan={klass.plan}
        locked={Boolean(modal.payload && collected[modal.payload.no])} collectedCount={collected[modal.payload?.no] || 0}
        className={klass.name} onClose={() => setModal(null)}
        onSave={(body) => run(() => (modal.payload
          ? api.patch(`/classes/${klass.id}/instalments/${modal.payload._id}`, body)
          : api.post(`/classes/${klass.id}/instalments`, body)), modal.payload ? 'Instalment saved' : 'Instalment added')} />}

      {modal?.type === 'delInst' && (
        <Confirm title={`Delete instalment ${modal.payload.no}?`} danger="Delete instalment" onClose={() => setModal(null)}
          onOk={() => run(() => api.delete(`/classes/${klass.id}/instalments/${modal.payload._id}`), 'Instalment deleted')}>
          <p style={{ margin: '0 0 8px' }}>{modal.payload.month} · {RS(modal.payload.parts.reduce((s, x) => s + x.amount, 0))}</p>
          <p className="tiny muted" style={{ margin: 0 }}>Nothing has been collected against it, so it is removed from the plan and from every unpaid ledger in {klass.name}.</p>
        </Confirm>
      )}

      {modal?.type === 'copy' && <CopyPlan classes={classes.filter((c) => c.id !== klass.id)} target={klass.name}
        onClose={() => setModal(null)}
        onSave={(body) => run(() => api.post(`/classes/${klass.id}/copy-plan`, body), 'Plan copied')} />}

      {modal?.type === 'head' && <HeadForm existing={modal.payload} onClose={() => setModal(null)}
        onSave={(body) => run(() => (modal.payload ? api.patch(`/fee-heads/${modal.payload._id}`, body) : api.post('/fee-heads', body)),
          modal.payload ? 'Fee head updated' : 'Fee head added')} />}
    </div>
  );
}

/* ------------------------------ sub-forms ------------------------------ */

const Confirm = ({ title, danger, children, onOk, onClose }) => (
  <Drawer title={title} sub="Fee Master" onClose={onClose} footer={(
    <>
      <button type="button" className="btn btn-primary" style={{ background: 'var(--crit)', borderColor: 'var(--crit)' }} onClick={onOk}>{danger}</button>
      <div style={{ flex: 1 }} />
      <button type="button" className="btn btn-ghost" onClick={onClose}>Keep it</button>
    </>
  )}>{children}</Drawer>
);

function ClassForm({ existing, classes, onSave, onClose }) {
  const [f, setF] = useState({
    name: existing?.name || '', code: existing?.code || '',
    status: existing?.status || 'draft', source: existing?.source || '', copyFrom: '',
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Drawer title={existing ? 'Edit class' : 'Add a class'} sub="Fee Master" onClose={onClose} footer={(
      <>
        <button type="button" className="btn btn-primary" onClick={() => onSave(f)}>{existing ? 'Save class' : 'Create class'}</button>
        <div style={{ flex: 1 }} />
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </>
    )}>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Field label="Class name *" style={{ gridColumn: '1/-1' }}><Input maxLength={30} value={f.name} onChange={set('name')} placeholder="e.g. Pre-Nursery" /></Field>
        <Field label="Class code *"><Input className="input mono" maxLength={6} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} readOnly={Boolean(existing)} placeholder="PRE" /></Field>
        <Field label="Plan status">
          <Select value={f.status} onChange={set('status')}>
            <option value="draft">Draft — still being set up</option>
            <option value="verified">Verified — locked for the session</option>
          </Select>
        </Field>
        <Field label="Source note" style={{ gridColumn: '1/-1' }}><Input maxLength={60} value={f.source} onChange={set('source')} placeholder="e.g. Fee card approved 12 Mar" /></Field>
        {!existing && (
          <Field label="Start the fee plan from" style={{ gridColumn: '1/-1' }}>
            <Select value={f.copyFrom} onChange={set('copyFrom')}>
              <option value="">Empty plan — I will add instalments</option>
              {classes.map((c) => <option key={c.id} value={c.id}>Copy {c.name} — {c.plan.length} instalments · {RS(c.sessionTotal)}</option>)}
            </Select>
          </Field>
        )}
      </div>
    </Drawer>
  );
}

function InstForm({ existing, heads, plan, locked, collectedCount, className, onSave, onClose }) {
  const nextNo = ROMAN.find((r) => !plan.some((p) => p.no === r)) || String(plan.length + 1);
  const usable = heads.filter((h) => !['penalty', 'carry-forward'].includes(h.type));
  const [f, setF] = useState({
    no: existing?.no || nextNo,
    dueDate: existing ? new Date(existing.dueDate).toISOString().slice(0, 10) : '',
    parts: existing ? existing.parts.map((p) => ({ head: p.head?._id || p.head, amount: p.amount }))
      : [{ head: usable[0]?._id || '', amount: 0 }],
  });
  const total = f.parts.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const setPart = (i, k, v) => setF((p) => ({ ...p, parts: p.parts.map((x, j) => (j === i ? { ...x, [k]: v } : x)) }));

  return (
    <Drawer wide title={existing ? `Edit instalment ${existing.no}` : 'Add instalment'} sub={`Fee Master · ${className}`}
      onClose={onClose} footer={locked ? <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button> : (
        <>
          <button type="button" className="btn btn-primary" onClick={() => onSave(f)}>{existing ? 'Save instalment' : 'Add instalment'}</button>
          <div style={{ flex: 1 }} />
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </>
      )}>
      {locked && (
        <div className="locked-note" style={{ marginBottom: 14, color: 'var(--warn)', background: 'var(--warn-soft)', borderColor: 'var(--warn)' }}>
          Already collected from {collectedCount} student(s) — read-only. Create a new instalment instead.
        </div>
      )}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
        <Field label="Instalment no. *"><Input className="input mono" maxLength={6} value={f.no} readOnly={locked}
          onChange={(e) => setF({ ...f, no: e.target.value.toUpperCase() })} /></Field>
        <Field label="Due date *"><Input type="date" value={f.dueDate} readOnly={locked} onChange={(e) => setF({ ...f, dueDate: e.target.value })} /></Field>
        <Field label="Due month (auto)"><Input readOnly value={monthLabel(f.dueDate)} /></Field>
      </div>
      <hr className="hr" />
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="lbl">Fee heads in this instalment</div>
        {!locked && <button type="button" className="btn btn-sm" onClick={() => setF({ ...f, parts: [...f.parts, { head: usable[0]?._id || '', amount: 0 }] })}>+ Add head</button>}
      </div>
      <div className="tbl-wrap" style={{ border: '1px solid var(--line)', borderRadius: 'var(--r)', marginTop: 8 }}>
        <table>
          <thead><tr><th>Fee head</th><th className="t-right">Amount</th><th /></tr></thead>
          <tbody>
            {f.parts.map((p, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <tr key={i}>
                <td>
                  <select className="input" disabled={locked} value={p.head} onChange={(e) => setPart(i, 'head', e.target.value)}>
                    {usable.map((h) => <option key={h._id} value={h._id}>{h.name}</option>)}
                  </select>
                </td>
                <td className="t-right">
                  <input className="input num" style={{ width: 120 }} inputMode="numeric" readOnly={locked} value={p.amount}
                    onChange={(e) => setPart(i, 'amount', Number(e.target.value.replace(/\D/g, '')) || 0)} />
                </td>
                <td className="t-right">
                  {!locked && f.parts.length > 1 && (
                    <button type="button" className="btn btn-sm btn-ghost" title="Remove this line"
                      onClick={() => setF({ ...f, parts: f.parts.filter((_, j) => j !== i) })}>✕</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: 'var(--surface-2)' }}>
              <td style={{ fontWeight: 700 }}>Instalment total</td>
              <td className="num" style={{ fontWeight: 700, fontSize: 15 }}>{RS(total)}</td><td />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="tiny muted" style={{ margin: '12px 0 0' }}>
        The same head can be added twice — that is how “2 months tuition” is shown on a printed card.
        Saving updates every unpaid ledger row in {className}; paid rows are never touched.
      </p>
    </Drawer>
  );
}

function CopyPlan({ classes, target, onSave, onClose }) {
  const [f, setF] = useState({ from: classes[0]?.id || '', adjustPercent: 0 });
  return (
    <Drawer title={`Copy fee plan into ${target}`} sub="Fee Master" onClose={onClose} footer={(
      <>
        <button type="button" className="btn btn-primary" onClick={() => onSave(f)}>Copy plan</button>
        <div style={{ flex: 1 }} />
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </>
    )}>
      <Field label="Copy the plan from">
        <Select value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })}>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.plan.length} instalments · {RS(c.sessionTotal)}</option>)}
        </Select>
      </Field>
      <Field label="Adjust every amount by" style={{ marginTop: 12 }}>
        <Select value={f.adjustPercent} onChange={(e) => setF({ ...f, adjustPercent: Number(e.target.value) })}>
          <option value={0}>No change</option><option value={5}>+5%</option><option value={10}>+10%</option><option value={-5}>−5%</option>
        </Select>
      </Field>
      <hr className="hr" />
      <p className="tiny muted" style={{ margin: 0 }}>Instalments already collected in {target} are kept as they are; everything else is replaced.</p>
    </Drawer>
  );
}

function HeadForm({ existing, onSave, onClose }) {
  const [f, setF] = useState({ name: existing?.name || '', code: existing?.code || '', type: existing?.type || 'recurring' });
  return (
    <Drawer title={existing ? 'Edit fee head' : 'Add fee head'} sub="Fee Master" onClose={onClose} footer={(
      <>
        <button type="button" className="btn btn-primary" onClick={() => onSave(f)}>{existing ? 'Save head' : 'Add head'}</button>
        <div style={{ flex: 1 }} />
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </>
    )}>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Field label="Head name *" style={{ gridColumn: '1/-1' }}><Input maxLength={32} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Exam Fee" /></Field>
        <Field label="Type">
          <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            {['recurring', 'one-time', 'periodic', 'penalty', 'carry-forward'].map((t) => <option key={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="Code"><Input className="input mono" maxLength={12} value={f.code} readOnly={Boolean(existing)}
          onChange={(e) => setF({ ...f, code: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') })} placeholder="exam" /></Field>
      </div>
      <p className="tiny muted" style={{ margin: '14px 0 0' }}>
        Recurring heads repeat every month, one-time heads are charged once at admission, periodic heads (like a half-yearly fee) fall on set instalments.
      </p>
    </Drawer>
  );
}
