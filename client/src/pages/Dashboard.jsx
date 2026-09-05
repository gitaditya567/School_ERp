import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Panel, Kpi, Chip, Bar, Loading, ErrorBox, Empty } from '../components/ui';
import { CashFlowChart, Donut, Sparkline } from '../components/Charts';
import { RS, monthName } from '../lib/format';

export default function Dashboard() {
  const { can, canView, user } = useAuth();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('both');

  const load = () => {
    setError(null);
    api.get('/dashboard').then(setData).catch(setError);
  };
  useEffect(() => { document.title = 'Dashboard'; load(); }, []);

  if (error) return <ErrorBox error={error} onRetry={load} />;
  if (!data) return <Loading label="Loading dashboard…" />;

  const { totals, series, months, instalments, classRows, defaulters, collection } = data;
  const empty = totals.gross === 0 && data.students === 0;
  const maxClass = Math.max(...classRows.map((c) => c.demand), 1);

  if (empty) {
    return (
      <Panel title="Nothing here yet" sub="Set the school up in three steps">
        <ol className="muted" style={{ lineHeight: 2, paddingLeft: 18, margin: 0 }}>
          <li>Open <b>Fee Master</b> and create your classes with their instalment plan.</li>
          <li>Add students under <b>New Admission</b> — each one gets a fee ledger automatically.</li>
          <li>Start collecting under <b>Collect Fee</b>; receipts and reports fill in from there.</li>
        </ol>
        <div className="row" style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-primary" onClick={() => nav('/fee-master')}>Open Fee Master</button>
          {can('admit') && <button type="button" className="btn" onClick={() => nav('/admission')}>New admission</button>}
        </div>
      </Panel>
    );
  }

  return (
    <div className="stack">
      <div className="kpis">
        <Kpi accent label={`${monthName(data.thisMonth)} collection`} value={RS(collection.thisMonth)}
          foot={(
            <>
              <Chip tone={collection.delta >= 0 ? 'paid' : 'over'}>
                {collection.delta >= 0 ? '▲' : '▼'} {Math.abs(collection.delta)}% vs last month
              </Chip>
              <Sparkline values={series.map((s) => s.collection)} />
            </>
          )} />
        <Kpi label="Outstanding" value={RS(totals.outstanding)} color="var(--warn)"
          foot={(
            <>
              <span>{RS(totals.overdue)} overdue</span>
              {canView('reports') && <button type="button" className="btn btn-sm" onClick={() => nav('/reports')}>View list →</button>}
            </>
          )} />
        <Kpi label="Students on roll" value={data.students}
          foot={(
            <>
              <span>{data.defaulterCount} with overdue fee</span>
              <Chip tone={data.defaulterCount ? 'over' : 'paid'}>
                {data.students ? Math.round((data.defaulterCount / data.students) * 100) : 0}% overdue
              </Chip>
            </>
          )} />
        <Kpi label="Concessions given" value={RS(totals.discount)} color="var(--brand)"
          foot={(
            <>
              <span>{data.concessionCount} approvals</span>
              {canView('concessions') && <button type="button" className="btn btn-sm" onClick={() => nav('/concessions')}>Register →</button>}
            </>
          )} />
      </div>

      <div className="split">
        <Panel title="Cash flow" sub="Hover a month for the figures"
          actions={(
            <div className="seg">
              <button type="button" aria-pressed={mode === 'both'} onClick={() => setMode('both')}>Collection vs expense</button>
              <button type="button" aria-pressed={mode === 'net'} onClick={() => setMode('net')}>Net</button>
            </div>
          )}>
          <CashFlowChart series={series} labels={months.map(monthName)} mode={mode} />
        </Panel>

        <div className="stack">
          <Panel title="Session progress" sub="Against net demand">
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <Donut pct={totals.collectedPct} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flex: 1, minWidth: 0 }}>
                <div><div className="lbl">Collected</div><div className="mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--good)' }}>{RS(totals.paid)}</div></div>
                <div><div className="lbl">Outstanding</div><div className="mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--warn)' }}>{RS(totals.outstanding)}</div></div>
                <div><div className="lbl">Net demand</div><div className="mono tiny" style={{ fontWeight: 600 }}>{RS(totals.netDemand)}</div></div>
              </div>
            </div>
          </Panel>
          <Panel title="Quick actions">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
              {can('collect') && <button type="button" className="btn btn-primary" style={{ gridColumn: '1/-1', justifyContent: 'center' }} onClick={() => nav('/collect')}>Collect fee</button>}
              {can('admit') && <button type="button" className="btn" style={{ justifyContent: 'center' }} onClick={() => nav('/admission')}>New admission</button>}
              {canView('reports') && <button type="button" className="btn" style={{ justifyContent: 'center' }} onClick={() => nav('/reports')}>Reports</button>}
              {canView('students') && <button type="button" className="btn" style={{ justifyContent: 'center' }} onClick={() => nav('/students')}>Student directory</button>}
              {canView('receipts') && <button type="button" className="btn" style={{ justifyContent: 'center' }} onClick={() => nav('/receipts')}>Receipt register</button>}
            </div>
          </Panel>
        </div>
      </div>

      <div className="split">
        <Panel bodyless title="Instalment-wise status" sub="Click a row for that month's due list">
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr><th>Inst.</th><th>Due month</th><th className="t-right">Net demand</th><th className="t-right">Collected</th><th style={{ width: 150 }}>Progress</th><th className="t-right">Pending</th></tr>
              </thead>
              <tbody>
                {instalments.length === 0 && <tr><td colSpan={6}><Empty>No fee plan yet.</Empty></td></tr>}
                {instalments.map((r) => {
                  const pct = r.demand ? Math.round((r.collected / r.demand) * 100) : 0;
                  return (
                    <tr key={r.instNo} className="clickable" onClick={() => canView('reports') && nav('/reports')}>
                      <td><b className="mono">{r.instNo}</b></td>
                      <td className="nw">{r.month}</td>
                      <td className="num">{RS(r.demand)}</td>
                      <td className="num">{RS(r.collected)}</td>
                      <td><Bar pct={pct} color={pct === 100 ? 'var(--good)' : pct > 0 ? 'var(--teal)' : 'var(--line-2)'} /></td>
                      <td className="num">
                        {r.pending ? <Chip tone={pct > 0 ? 'due' : 'up'}>{r.pending} student{r.pending > 1 ? 's' : ''}</Chip> : <Chip tone="paid">Clear</Chip>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="stack">
          <Panel title="Class-wise collection">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {classRows.length === 0 && <Empty>No classes yet.</Empty>}
              {classRows.map((c) => (
                <div key={c.classId}>
                  <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 12.5 }}>{c.name}</span>
                    <span className="mono tiny" style={{ fontWeight: 600 }}>{RS(c.collected)} <span className="muted">/ {RS(c.demand)}</span></span>
                  </div>
                  <div style={{ marginTop: 5 }}><Bar pct={(c.collected / maxClass) * 100} color="var(--brand)" /></div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel bodyless title="Needs attention" sub="Highest overdue first">
            <div className="tbl-wrap">
              <table>
                <tbody>
                  {defaulters.length === 0 && <tr><td><Empty>Nothing overdue — all clear</Empty></td></tr>}
                  {defaulters.map((d) => (
                    <tr key={d.id} className="clickable" onClick={() => nav(`/students/${d.id}`)}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{d.name}</div>
                        <div className="tiny muted">{d.admissionNo} · {d.className} · {d.instalments} inst.</div>
                      </td>
                      <td className="num" style={{ color: 'var(--crit)', fontWeight: 700 }}>{RS(d.overdue)}</td>
                      <td className="t-right">
                        <button type="button" className="btn btn-sm btn-primary"
                          onClick={(e) => { e.stopPropagation(); nav(can('collect') ? `/collect?student=${d.id}` : `/students/${d.id}`); }}>
                          {can('collect') ? 'Collect' : 'Open'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </div>
      <p className="tiny muted">Signed in as {user?.name}. Figures cover only what your role is allowed to see.</p>
    </div>
  );
}
