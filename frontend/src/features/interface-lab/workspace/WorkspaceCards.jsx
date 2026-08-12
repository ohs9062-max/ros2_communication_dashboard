import { Badge } from './WorkspaceShared.jsx'

export function SummaryCard({ label, tone = 'neutral', value }) {
  return (
    <div className={`interface-summary-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export function InterfaceCard({ item, onClick, selected }) {
  const status = primaryStatus(item)
  return (
    <button className={selected ? 'interface-card selected' : 'interface-card'} onClick={onClick} type="button">
      <span className="interface-card-line">
        <strong title={item.title}>{item.title}</strong>
        <span title={item.fullType ?? item.subtitle}>{item.fullType ?? item.subtitle ?? '-'}</span>
      </span>
      <div className="interface-badge-row">
        <KindBadge kind={item.kind} />
        <Badge label={status.label} tone={status.tone} />
        <span className="interface-card-action">상세 보기</span>
      </div>
    </button>
  )
}

function primaryStatus(item) {
  if (item.error) return { label: '오류', tone: 'red' }
  if (item.rebuildRequired) return { label: 'build 필요', tone: 'yellow' }
  if (item.callable === true) return { label: '실행 가능', tone: 'green' }
  if (item.kind === 'message' && item.importAvailable) return { label: '실행 가능', tone: 'green' }
  if (item.importAvailable === false) return { label: 'import 필요', tone: 'yellow' }
  if (item.serverAvailable === false) return { label: '서버 없음', tone: 'yellow' }
  return { label: '등록됨', tone: 'blue' }
}

function KindBadge({ kind }) {
  const normalized = kind === 'callable_service' ? 'service'
    : kind === 'callable_action' ? 'action'
    : kind
  if (normalized === 'message') return <Badge label="msg" tone="msg" />
  if (normalized === 'service') return <Badge label="srv" tone="srv" />
  if (normalized === 'action') return <Badge label="action" tone="action" />
  if (normalized === 'package') return <Badge label="pkg" tone="package" />
  return null
}
