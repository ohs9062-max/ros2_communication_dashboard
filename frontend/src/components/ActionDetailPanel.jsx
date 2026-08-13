import { formatTime } from '../utils/format.js'
import { displayText } from '../utils/displayText.js'
import { DetailSection } from './DetailSection.jsx'
import { QosDetails } from './QosDetails.jsx'
import { QosSummaryNotice } from './QosSummary.jsx'
import { StatusBadge } from './StatusBadge.jsx'
import {
  ActionCapabilitySection,
  ActionConnectionSection,
  ActionExecutionSection,
  ActionPreviewSections,
  DetailLine,
} from '../features/actions/ActionDetailSections.jsx'
import { actionStatusTone } from '../features/actions/actionPresentation.js'

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
  const goalUnobserved = (runtime.observed_goal_count ?? 0) === 0 && !goalSummary
  const goalExecuting = runtime.last_goal_status === 'executing'
  const feedbackReceived = Boolean(runtime.feedback_preview)
  const feedbackWaiting =
    ['accepted', 'executing', 'canceling'].includes(
      String(runtime.last_goal_status || '').toLowerCase(),
    ) && !feedbackReceived

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

      <QosSummaryNotice
        kind="action"
        qos={action.qos}
      />

      {action.result_policy === 'observed_goal_only' && (
        <p className="notice-text">
          결과 조회 정책: 관찰된 Goal만 조회합니다. 대시보드는 Goal을 직접
          보내지 않고, 상태 topic에서 관찰한 Goal이 종료되었을 때만 결과를
          조회합니다.
        </p>
      )}
      {goalUnobserved && (
        <p className="notice-text">
          아직 관찰된 Goal이 없어 피드백도 수신되지 않았습니다. 외부 Action
          Client가 Goal을 보내면 상태, 피드백, 결과, 실행 시간이 여기에
          표시됩니다.
        </p>
      )}
      {feedbackWaiting && (
        <p className="notice-text">
          현재 Goal이 실행 중이지만 아직 피드백 미리보기는 없습니다.
        </p>
      )}
      {feedbackReceived && (
        <p className="notice-text">
          최근 수신한 피드백 미리보기입니다.
        </p>
      )}
      {goalExecuting && (
        <p className="notice-text">
          현재 Goal이 실행 중이므로 최종 결과는 아직 없습니다. 실행이 끝나면
          결과가 표시됩니다.
        </p>
      )}
      {action.feedback_supported === false && (
        <p className="notice-text">
          The Feedback type cannot be interpreted in the current Monitor environment.
        </p>
      )}
      {action.result_supported === false && (
        <p className="notice-text">
          The Result type cannot be interpreted in the current Monitor environment.
        </p>
      )}
      {runtime.last_goal_status === 'aborted' && (
        <p className="error-text">
          The Action ended with an aborted result. Check the Feedback or Result message for details.
        </p>
      )}

      <DetailSection title="상태 요약">
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

      <QosDetails
        focusRequest={qosFocusRequest?.name === action.name ? qosFocusRequest : null}
        qos={action.qos}
        title="Action 내부 통신 QoS"
      />

      <ActionConnectionSection action={action} participants={participants} />
      <ActionExecutionSection action={action} goalSummary={goalSummary} runtime={runtime} />
      <ActionCapabilitySection action={action} />
      <ActionPreviewSections goalSummary={goalSummary} runtime={runtime} />
    </aside>
  )
}
