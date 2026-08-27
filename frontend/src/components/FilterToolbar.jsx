const FILTERS = [
  { id: 'primary', label: '주요 항목' },
  { id: 'all', label: '전체' },
  { id: 'waiting', label: '대기 중' },
  { id: 'active', label: '정상' },
  { id: 'issues', label: '오류' },
]

export function FilterToolbar({
  search,
  statusFilter,
  onSearchChange,
  onStatusFilterChange,
  domainIds,
  selectedDomainId,
  onDomainChange,
}) {
  return (
    <div className="filter-toolbar topic-toolbar">
      <input
        aria-label="Topic 검색"
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="이름 또는 타입, Domain 검색"
        type="search"
        value={search}
      />
      <div className="service-filter-actions">
        <div className="filter-buttons" role="group" aria-label="상태 필터">
          {FILTERS.map((filter) => (
            <button
              className={
                statusFilter === filter.id ? 'filter active' : 'filter'
              }
              key={filter.id}
              onClick={() => onStatusFilterChange(filter.id)}
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
import { DomainFilterButtons } from './DomainFilterButtons.jsx'
