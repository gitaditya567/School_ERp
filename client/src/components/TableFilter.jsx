import { useMemo, useState } from 'react';

/**
 * Column filters + click-to-sort for data tables.
 *
 * columns: [{ key, label, value: (row) => any, filter: 'text' | 'select' | 'none',
 *             sortable (default true unless filter is 'none'), className, style }]
 *
 * Text filters match anywhere, case-insensitive. On number columns a filter like
 * ">5000", "<=200" or "=0" compares numerically. Select filters list the column's values.
 */
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function naturalCompare(a, b) {
  const an = a === null || a === undefined || a === '';
  const bn = b === null || b === undefined || b === '';
  if (an || bn) return an === bn ? 0 : an ? 1 : -1; // blanks last
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return collator.compare(String(a), String(b));
}

const text = (v) => (v === null || v === undefined ? '' : String(v)).toLowerCase();

function matches(value, query, kind) {
  if (kind === 'select') return String(value ?? '') === query;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const op = q.match(/^(>=|<=|>|<|=)\s*(-?\d+(?:\.\d+)?)$/);
  if (op && typeof value === 'number') {
    const n = Number(op[2]);
    return { '>': value > n, '<': value < n, '>=': value >= n, '<=': value <= n, '=': value === n }[op[1]];
  }
  return text(value).includes(q);
}

export function useTableFilter(rows, columns, { sort: initialSort = null } = {}) {
  const [filters, setFilters] = useState({});
  const [sort, setSort] = useState(initialSort); // { key, dir: 1 | -1 }
  const list = rows || [];
  const byKey = useMemo(() => Object.fromEntries(columns.map((c) => [c.key, c])), [columns]);

  const options = useMemo(() => {
    const out = {};
    columns.filter((c) => c.filter === 'select').forEach((c) => {
      out[c.key] = [...new Set(list.map((r) => c.value(r)).filter((v) => v !== '' && v !== null && v !== undefined).map(String))]
        .sort(naturalCompare);
    });
    return out;
  }, [list, columns]);

  const shown = useMemo(() => {
    const active = Object.entries(filters).filter(([, q]) => q !== '' && q !== undefined);
    let out = active.length
      ? list.filter((r) => active.every(([k, q]) => byKey[k] && matches(byKey[k].value(r), q, byKey[k].filter)))
      : list;
    if (sort && byKey[sort.key]) {
      const col = byKey[sort.key];
      const get = col.sortValue || col.value;
      out = [...out].sort((a, b) => naturalCompare(get(a), get(b)) * sort.dir);
    }
    return out;
  }, [list, filters, sort, byKey]);

  const active = Object.values(filters).some((q) => q !== '' && q !== undefined);
  return {
    rows: shown,
    total: list.length,
    filters,
    options,
    sort,
    active,
    setFilter: (key, q) => setFilters((f) => ({ ...f, [key]: q })),
    clear: () => setFilters({}),
    toggleSort: (key) => setSort((s) => (!s || s.key !== key ? { key, dir: 1 } : s.dir === 1 ? { key, dir: -1 } : initialSort)),
  };
}

const inputStyle = {
  width: '100%', minWidth: 60, padding: '4px 7px', fontSize: 12, fontWeight: 400, letterSpacing: 0,
  textTransform: 'none', border: '1px solid var(--line-2)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)',
};

/** <thead> with a sortable label row and a filter row. Use tf.rows for the body. */
export function FilterHead({ columns, tf }) {
  const firstBlank = columns.findIndex((c) => c.filter === 'none');
  return (
    <thead>
      <tr>
        {columns.map((c) => {
          const sortable = c.sortable ?? c.filter !== 'none';
          const on = tf.sort?.key === c.key;
          return (
            <th key={c.key} className={c.className} style={{ ...c.style, cursor: sortable ? 'pointer' : undefined, userSelect: 'none' }}
              onClick={sortable ? () => tf.toggleSort(c.key) : undefined}
              title={sortable ? 'Click to sort' : undefined}
              aria-sort={on ? (tf.sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
              {c.label}
              {sortable && <span style={{ marginLeft: 4, opacity: on ? 1 : 0.3 }}>{on ? (tf.sort.dir === 1 ? '▲' : '▼') : '↕'}</span>}
            </th>
          );
        })}
      </tr>
      <tr className="filter-row">
        {columns.map((c, i) => (
          <th key={c.key} style={{ position: 'static', padding: '5px 8px', background: 'var(--surface)' }}>
            {c.filter === 'select' && (
              <select style={inputStyle} value={tf.filters[c.key] || ''} onChange={(e) => tf.setFilter(c.key, e.target.value)}
                aria-label={`Filter ${c.label}`}>
                <option value="">All</option>
                {(tf.options[c.key] || []).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            )}
            {(!c.filter || c.filter === 'text') && (
              <input style={inputStyle} value={tf.filters[c.key] || ''} onChange={(e) => tf.setFilter(c.key, e.target.value)}
                placeholder="Filter…" aria-label={`Filter ${c.label}`}
                title={c.placeholder ? `Type a value, or compare amounts: e.g. ${c.placeholder}, <500, =0` : 'Type to filter'} />
            )}
            {c.filter === 'none' && i === firstBlank && tf.active && (
              <button type="button" className="btn btn-sm btn-ghost" style={{ padding: '2px 8px', fontSize: 11.5 }} onClick={tf.clear}>✕ Clear</button>
            )}
          </th>
        ))}
      </tr>
    </thead>
  );
}

/** "Showing 12 of 240 · Clear" when a filter hides rows. */
export function FilterCount({ tf }) {
  if (!tf.active) return null;
  return (
    <span className="tiny muted" style={{ whiteSpace: 'nowrap' }}>
      · Showing {tf.rows.length} of {tf.total} ·{' '}
      <button type="button" onClick={tf.clear}
        style={{ border: 0, background: 'none', padding: 0, color: 'var(--brand)', cursor: 'pointer', font: 'inherit', fontWeight: 600 }}>
        Clear filters
      </button>
    </span>
  );
}
