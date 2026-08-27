const SERVICE_FILTERS = [
  { id: 'primary', label: '주요 항목' },
  { id: 'all', label: '전체' },
  { id: 'waiting', label: '대기 중' },
  { id: 'active', label: '정상' },
  { id: 'issues', label: '오류' },
]

export function ServiceFilterToolbar({ domainIds, onDomainChange, search, selectedDomainId, setSearch, setStatusFilter, statusFilter }) {
  return (
    <div className="filter-toolbar service-toolbar">
      <input
        aria-label="Service 검색"
        onChange={(event) => setSearch(event.target.value)}
        placeholder="이름 또는 타입, Domain 검색"
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
        <DomainFilterButtons
          domainIds={domainIds}
          onChange={onDomainChange}
          selectedDomainId={selectedDomainId}
        />
      </div>
    </div>
  )
}
import { DomainFilterButtons } from '../../components/DomainFilterButtons.jsx'
