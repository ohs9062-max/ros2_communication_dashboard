import { formatTime } from '../utils/format.js'
import { DetailSection } from './DetailSection.jsx'
import { QosDetails } from './QosDetails.jsx'
import { StatusBadge } from './StatusBadge.jsx'
import {
  ActionCapabilitySection,
  ActionConnectionSection,
  ActionExecutionSection,
  ActionPreviewSections,
  DetailLine,
} from '../features/actions/ActionDetailSections.jsx'
import { actionStatusTone } from '../features/actions/actionPresentation.js'

export function ActionDetailPanel({ action, participants }) {
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
        <StatusBadge value={action.status} />
      </div>
      <h2>{action.name}</h2>
      <p className="muted">{action.type ?? '-'}</p>

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
          이 Action의 피드백 타입을 현재 백엔드 환경에서 해석할 수 없습니다.
        </p>
      )}
      {action.result_supported === false && (
        <p className="notice-text">
          이 Action의 결과 타입을 현재 백엔드 환경에서 해석할 수 없습니다.
        </p>
      )}
      {runtime.last_goal_status === 'aborted' && (
        <p className="error-text">
          이 Action은 실패 종료되었습니다. 상세 원인은 피드백 또는 결과
          메시지를 확인하세요.
        </p>
      )}

      <DetailSection title="상태 요약">
        <DetailLine label="이름" value={action.name} />
        <DetailLine label="타입" value={action.type ?? '-'} />
        <DetailLine
          label="서버 상태"
          tone={actionStatusTone(action.status)}
          value={action.status ?? '-'}
        />
        <DetailLine label="상태 이유" value={action.reason ?? '-'} />
        <DetailLine label="마지막 갱신" value={formatTime(action.last_updated)} />
      </DetailSection>

      <QosDetails qos={action.qos} title="Action 내부 통신 QoS" />

      <ActionConnectionSection action={action} participants={participants} />
      <ActionExecutionSection action={action} goalSummary={goalSummary} runtime={runtime} />
      <ActionCapabilitySection action={action} />
      <ActionPreviewSections goalSummary={goalSummary} runtime={runtime} />
    </aside>
  )
}
