import { Fragment, useState } from 'react';

// Generic grouping wrapper for an admin table's <tbody> — clusters rows
// under collapsible headers by whatever key the caller provides (role,
// status, category, ...), while leaving each row's own column rendering
// completely untouched (`renderRow` is the same row-JSX function the caller
// would otherwise pass straight to `.map`). `groupBy` is falsy for the
// normal flat view — grouping is opt-in per table, never the default, since
// most admin work is scanning/acting on individual rows, not by cluster.
export default function GroupedTableRows({ rows, groupBy, groupKeyFn, renderRow, colSpan }) {
  const [collapsed, setCollapsed] = useState(() => new Set());

  if (!groupBy) return rows.map(renderRow);

  const groups = new Map();
  rows.forEach(row => {
    const key = groupKeyFn(row) || 'Unassigned';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });
  const sortedKeys = [...groups.keys()].sort((a, b) => String(a).localeCompare(String(b)));

  const toggle = (key) => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  return sortedKeys.map(key => {
    const items = groups.get(key);
    const isCollapsed = collapsed.has(key);
    return (
      <Fragment key={key}>
        <tr className="table-light" style={{ cursor: 'pointer' }} onClick={() => toggle(key)}>
          <td colSpan={colSpan} className="fw-semibold small py-2">
            <i className={`bi ${isCollapsed ? 'bi-chevron-right' : 'bi-chevron-down'} me-2`}></i>
            {key} <span className="text-muted fw-normal">({items.length})</span>
          </td>
        </tr>
        {!isCollapsed && items.map(renderRow)}
      </Fragment>
    );
  });
}

// Small "Group by: [ ]" dropdown — shared markup for every admin table that
// offers grouping, so they all look and behave the same way.
export function GroupBySelect({ value, onChange, options }) {
  return (
    <div className="d-flex align-items-center gap-2">
      <label className="form-label small mb-0 text-muted">Group by</label>
      <select className="form-select form-select-sm" style={{ width: 'auto' }} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">None</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
