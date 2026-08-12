import { SummaryCard } from './SummaryCard.jsx'

export function NodeSummaryCards({ meta = {}, nodes = [], primaryNodes = [] }) {
  const total = meta.count ?? nodes.length
  const active = meta.active_count ?? countByStatus(nodes, 'active')
  const disconnected = countByStatus(nodes, 'disconnected')

  return (
    <div className="summary-grid node-summary-grid">
      <SummaryCard label="전체 Node" value={total} />
      <SummaryCard label="주요 Node" value={primaryNodes.length} tone="good" />
      <SummaryCard label="실행 중" value={active} tone="good" />
      <SummaryCard
        label="종료 감지"
        tone={disconnected ? 'bad' : 'default'}
        value={disconnected}
      />
      <SummaryCard
        label="Topic 연결"
        value={
          (meta.publisher_count ?? sumCount(nodes, 'publisher_count')) +
          (meta.subscriber_count ?? sumCount(nodes, 'subscriber_count'))
        }
      />
    </div>
  )
}

function countByStatus(nodes, status) {
  return nodes.filter((node) => node.status === status).length
}

function sumCount(nodes, key) {
  return nodes.reduce((sum, node) => sum + (node[key] ?? 0), 0)
}
