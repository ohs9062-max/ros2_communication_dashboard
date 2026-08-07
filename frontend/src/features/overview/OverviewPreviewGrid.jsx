import { AlertsPreview } from '../../components/AlertsPreview.jsx'
import { StatusBadge } from '../../components/StatusBadge.jsx'
import { resourceStatus } from './overviewSummary.js'

export function OverviewPreviewGrid({
  actionSummary,
  alertError,
  alerts,
  nodeSummary,
  onAlertClick,
  onNavigate,
  serviceSummary,
  topicSummary,
}) {
  return (
    <section className="overview-preview-grid">
      <AlertsPreview
        alerts={alerts}
        collapsedItems={3}
        collapsible
        error={alertError}
        maxItems={10}
        onAlertClick={onAlertClick}
      />
      <PreviewCard
        metrics={[
          { label: '실행 중', value: nodeSummary.active },
          { label: '주의/오류', value: nodeSummary.warning + nodeSummary.error },
          { label: 'Pub/Sub', value: nodeSummary.pubSub },
        ]}
        onClick={() => onNavigate('nodes')}
        status={resourceStatus(nodeSummary)}
        title="Node 미리보기"
        total={nodeSummary.total}
      />
      <PreviewCard
        metrics={[
          { label: '정상', value: topicSummary.active },
          { label: '구독자 없음', value: topicSummary.noSubscriber },
          { label: '주의', value: topicSummary.warning },
        ]}
        onClick={() => onNavigate('topics')}
        status={resourceStatus(topicSummary)}
        title="Topic 미리보기"
        total={topicSummary.total}
      />
      <PreviewCard
        metrics={[
          { label: '정상', value: serviceSummary.active },
          { label: '서버 대기', value: serviceSummary.warning },
          { label: '오류', value: serviceSummary.error },
        ]}
        onClick={() => onNavigate('services')}
        status={resourceStatus(serviceSummary)}
        title="Service 미리보기"
        total={serviceSummary.total}
      />
      <PreviewCard
        metrics={[
          { label: '정상', value: actionSummary.active },
          { label: '주의/오류', value: actionSummary.warning + actionSummary.error },
          { label: '관찰 Goal', value: actionSummary.observedGoals },
        ]}
        onClick={() => onNavigate('actions')}
        status={resourceStatus(actionSummary)}
        title="Action 미리보기"
        total={actionSummary.total}
      />
    </section>
  )
}

function PreviewCard({ title, total, status, metrics, onClick }) {
  return (
    <button className="overview-preview-card" onClick={onClick} type="button">
      <div className="overview-preview-head">
        <span>{title}</span>
        <StatusBadge value={status} />
      </div>
      <strong>{total}</strong>
      <div className="overview-preview-metrics">
        {metrics.map((metric) => (
          <span className="overview-preview-metric" key={metric.label}>
            {metric.label}: <b>{metric.value}</b>
          </span>
        ))}
      </div>
    </button>
  )
}
