export function DashboardCommunicationBadges({
  items,
  emptyLabel = '미사용',
}) {
  const visibleItems = items.filter((item) => item.active)

  return (
    <span className="dashboard-communication-badges">
      {visibleItems.length ? (
        visibleItems.map((item) => (
          <span
            className={`dashboard-communication-badge ${item.tone ?? 'active'}`}
            key={item.label}
          >
            {item.label}
          </span>
        ))
      ) : (
        <span className="dashboard-communication-badge inactive">
          {emptyLabel}
        </span>
      )}
    </span>
  )
}
