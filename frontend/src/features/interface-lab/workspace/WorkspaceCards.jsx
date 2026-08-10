import { sourceLabel } from '../model/workspacePresentation.js'
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
  return (
    <button className={selected ? 'interface-card selected' : 'interface-card'} onClick={onClick} type="button">
      <span className="interface-card-line">
        <strong>{item.title}</strong>
        <span>/</span>
        <span>{item.subtitle}</span>
        {item.counts && (
          <span className="interface-count-badges">
            <CountBadge label="msg" tone="msg" value={item.counts.message} />
            <CountBadge label="srv" tone="srv" value={item.counts.service} />
            <CountBadge label="action" tone="action" value={item.counts.action} />
          </span>
        )}
      </span>
      <div className="interface-badge-row">
        <KindBadge kind={item.kind} />
        {(item.sources?.length ? item.sources : [item.source]).filter(Boolean).map((source) => (
          <Badge key={source} label={sourceLabel(source)} tone="blue" />
        ))}
        {item.graphOnly && <Badge label="미등록" tone="yellow" />}
        {item.packageName && <Badge label={item.packageName} tone="neutral" />}
        {item.importAvailable !== null && (
          <Badge label={item.importAvailable ? 'import됨' : 'import 안됨'} tone={item.importAvailable ? 'green' : 'yellow'} />
        )}
        {item.graphOnly && item.importAvailable === null && <Badge label="import 확인 필요" tone="yellow" />}
        {item.rebuildRequired && <Badge label="build 필요" tone="yellow" />}
        {item.serverAvailable !== null && (
          <Badge label={item.serverAvailable ? '서버 있음' : '서버 없음'} tone={item.serverAvailable ? 'green' : 'yellow'} />
        )}
        {item.callable !== null && (
          <Badge label={item.callable ? '실행 가능' : item.reason ?? '실행 불가'} tone={item.callable ? 'green' : 'yellow'} />
        )}
        {item.error && <Badge label="오류" tone="red" />}
      </div>
    </button>
  )
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

function CountBadge({ label, tone, value }) {
  return <span className={`interface-count-badge ${tone}`}>{label} {value}</span>
}
