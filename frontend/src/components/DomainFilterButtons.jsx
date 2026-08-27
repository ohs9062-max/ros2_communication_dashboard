export function DomainFilterButtons({ domainIds = [], onChange, selectedDomainId }) {
  return (
    <div className="domain-filter-group" role="group" aria-label="Domain 필터">
      <span className="filter-group-label">Domain</span>
      <div className="filter-buttons">
        <button
          className={selectedDomainId === null ? 'filter active' : 'filter'}
          onClick={() => onChange(null)}
          type="button"
        >
          전체
        </button>
        {domainIds.map((domainId) => (
          <button
            className={selectedDomainId === domainId ? 'filter active' : 'filter'}
            key={domainId}
            onClick={() => onChange(domainId)}
            type="button"
          >
            D{domainId}
          </button>
        ))}
      </div>
    </div>
  )
}
