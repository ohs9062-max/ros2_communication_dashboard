import { CollapsibleList } from '../CollapsibleList.jsx'
import { StatusBadge } from '../StatusBadge.jsx'
import { VisualizationKindDetails } from './VisualizationKindDetails.jsx'
import { kindLabel, statusTone } from './visualizationPresentation.js'

export function VisualizationDetailPanel({ graphNode, missingNodeId }) {
  if (missingNodeId) {
    return (
      <aside className="detail-panel visualization-detail-panel">
        <div className="panel-heading">
          <span>통신 상세</span>
          <StatusBadge value="unknown" />
        </div>
        <h2>{missingNodeId.replace(/^[^:]+:/, '')}</h2>
        <p className="notice-text warning">
          선택 항목이 현재 Graph에서 사라졌습니다. 필터를 조정하거나 전체
          보기를 누르면 다시 표시될 수 있습니다.
        </p>
      </aside>
    )
  }

  if (!graphNode) {
    return (
      <aside className="detail-panel visualization-detail-panel">
        <div className="empty-state">
          그래프 항목을 선택하면 연결 상세가 표시됩니다.
        </div>
      </aside>
    )
  }

  const data = graphNode.data

  return (
    <aside className="detail-panel visualization-detail-panel">
      <div className="panel-heading">
        <span>통신 상세</span>
        <StatusBadge value={data.status ?? 'unknown'} />
      </div>
      <h2>{data.label}</h2>
      <p className="muted">{kindLabel(data.kind)}</p>

      <section className="detail-section">
        <h3>상태 요약</h3>
        <DetailLine label="종류" value={kindLabel(data.kind)} />
        <DetailLine label="이름" value={data.label} />
        <DetailLine label="타입" value={data.type ?? '-'} />
        <DetailLine
          label="상태"
          tone={statusTone(data.status)}
          value={data.status ?? '-'}
        />
      </section>

      <section className="detail-section">
        <h3>연결 정보</h3>
        <div className="metric-grid">
          <Metric
            label="들어오는 연결"
            value={data.connections?.incoming.length ?? 0}
          />
          <Metric
            label="나가는 연결"
            value={data.connections?.outgoing.length ?? 0}
          />
        </div>
        <ConnectionList
          emptyMessage="들어오는 연결 없음"
          items={data.connections?.incoming}
          title="들어오는 연결"
        />
        <ConnectionList
          emptyMessage="나가는 연결 없음"
          items={data.connections?.outgoing}
          title="나가는 연결"
        />
      </section>

      <section className="detail-section">
        <h3>상세 정보</h3>
        <VisualizationKindDetails data={data} />
      </section>
    </aside>
  )
}

function DetailLine({ label, tone, value }) {
  return (
    <div className="detail-line">
      <span>{label}</span>
      <strong className={tone ? `detail-value-${tone}` : undefined}>
        {value ?? '-'}
      </strong>
    </div>
  )
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function ConnectionList({ emptyMessage, items = [], title }) {
  return (
    <CollapsibleList
      emptyText={emptyMessage}
      items={items}
      renderItem={(item) => (
        <>
          <strong>{item.id.replace(/^[^:]+:/, '')}</strong>
          <span>{item.label}</span>
        </>
      )}
      title={title}
    />
  )
}
