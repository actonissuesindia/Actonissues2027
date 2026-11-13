const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

// A page-size selector + prev/next pager, shared by the admin Issues and
// Users tables. Purely a display control — the caller still holds the full
// filtered list and is expected to slice it: `list.slice((page-1)*pageSize, page*pageSize)`.
export default function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mt-3 pt-2 border-top">
      <div className="d-flex align-items-center gap-2">
        <span className="text-muted small">Show</span>
        <select
          className="form-select form-select-sm" style={{ width: 'auto' }}
          value={pageSize} onChange={e => onPageSizeChange(Number(e.target.value))}
        >
          {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span className="text-muted small">per page · {total} total</span>
      </div>
      {totalPages > 1 && (
        <div className="d-flex align-items-center gap-2">
          <button type="button" className="btn btn-sm btn-pill-outline" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            <i className="bi bi-chevron-left"></i>
          </button>
          <span className="text-muted small">Page {page} of {totalPages}</span>
          <button type="button" className="btn btn-sm btn-pill-outline" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
            <i className="bi bi-chevron-right"></i>
          </button>
        </div>
      )}
    </div>
  );
}
