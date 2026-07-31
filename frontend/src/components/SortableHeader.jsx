export function SortableHeader({
  columnKey,
  headerClassName = '',
  label,
  onSort,
  sort,
}) {
  const active = sort.key === columnKey
  const indicator = active ? (sort.direction === 'asc' ? '▲' : '▼') : '↕'
  const labelLines = Array.isArray(label) ? label : [label]

  return (
    <th className={headerClassName}>
      <button
        className={[
          'sort-header',
          labelLines.length > 1 ? 'multiline' : '',
          active ? 'active' : '',
        ].filter(Boolean).join(' ')}
        onClick={() => onSort(columnKey)}
        type="button"
      >
        <span className="sort-header-label">
          {labelLines.map((line) => <span key={line}>{line}</span>)}
        </span>
        <span className="sort-indicator" aria-hidden="true">
          {indicator}
        </span>
      </button>
    </th>
  )
}
