import { formatTime } from '../utils/format.js'
import { displayText } from '../utils/displayText.js'
import { DetailSection } from './DetailSection.jsx'
import { CommunicationHistory } from './CommunicationHistory.jsx'
import { QosDetails } from './QosDetails.jsx'
import { QosSummaryNotice } from './QosSummary.jsx'
import { StatusBadge } from './StatusBadge.jsx'
import {
  ActionConnectionSection,
  ActionExecutionSection,
  DetailLine,
} from '../features/actions/ActionDetailSections.jsx'
import {
  actionPresentation,
  actionStatusTone,
} from '../features/actions/actionPresentation.js'

export function ActionDetailPanel({ action, onClose, participants, qosFocusRequest }) {
  if (!action) {
    return (
      <aside className="detail-panel">
        <div className="empty-state">
          발견된 Action이 있으면 상세 정보가 표시됩니다
        </div>
      </aside>
    )
  }

  const runtime = action.runtime ?? {}
  const goalSummary = action.last_goal_summary
  const presentation = actionPresentation(action)

  return (
    <aside className="detail-panel">
      <div className="panel-heading">
        <span>Action 상세</span>
        <div className="detail-panel-heading-actions">
          <StatusBadge value={action.status} />
          <button className="detail-panel-close" onClick={onClose} type="button">닫기 ×</button>
        </div>
      </div>
      <h2>{action.name}</h2>
      <p className="muted">{action.type ?? '-'}</p>

      <DetailSection collapsible defaultOpen title="상태 요약">
        <DetailLine label="이름" value={action.name} />
        <DetailLine label="타입" value={action.type ?? '-'} />
        <DetailLine
          label="서버 상태"
          tone={actionStatusTone(action.status)}
          value={displayText(action.status)}
        />
        <DetailLine label="상태 이유" value={displayText(action.reason)} />
        <DetailLine label="마지막 갱신" value={formatTime(action.last_updated)} />
      </DetailSection>

      <QosSummaryNotice
        kind="action"
        qos={action.qos}
      />

      <QosDetails
        focusRequest={qosFocusRequest?.name === (action.resource_key ?? action.name) ? qosFocusRequest : null}
        qos={action.qos}
        title="Action 내부 통신 QoS"
      />

      <ActionConnectionSection action={action} participants={participants} />
      <ActionExecutionSection action={action} goalSummary={goalSummary} presentation={presentation} runtime={runtime} />
      <CommunicationHistory
        domainId={action.domain_id}
        kind="action"
        name={action.name}
        resourceType={action.type}
      />
    </aside>
  )
}
