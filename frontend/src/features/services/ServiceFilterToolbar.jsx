const SERVICE_FILTERS = [
  { id: 'primary', label: '주요 항목' },
  { id: 'issues', label: '대기/오류' },
  { id: 'all', label: '전체' },
  { id: 'internal', label: '내부/관리 포함' },
]

export function ServiceFilterToolbar({ search, setSearch, setStatusFilter, statusFilter }) {
  return (
    <div className="filter-toolbar service-toolbar">
      <input
        aria-label="Service 검색"
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Service 이름, 타입, 상태 검색"
        type="search"
        value={search}
      />
      <div className="service-filter-actions">
        <div className="filter-buttons" role="group" aria-label="Service 상태 필터">
          {SERVICE_FILTERS.map((filter) => (
            <button
              className={statusFilter === filter.id ? 'filter active' : 'filter'}
              key={filter.id}
              onClick={() => setStatusFilter(filter.id)}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
