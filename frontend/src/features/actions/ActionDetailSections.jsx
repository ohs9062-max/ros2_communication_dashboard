import { ConnectionNodeList } from '../../components/ConnectionNodeList.jsx'
import { DetailSection } from '../../components/DetailSection.jsx'
import { formatMs, formatRelativeTime } from '../../utils/format.js'
import { withExecutionNode } from '../../utils/participants.js'
import {
  actionStatusTone,
  goalStatusLabel,
  resultStatusLabel,
} from './actionPresentation.js'

export function DetailLine({ label, tone, value }) {
  return (
    <div className="detail-line">
      <span>{label}</span>
      <strong className={tone ? `detail-value-${tone}` : undefined}>{value}</strong>
    </div>
  )
}

export function ActionConnectionSection({ action, participants }) {
  return (
    <DetailSection collapsible title="연결 정보">
      <DetailLine label="Server" value={action.server_node_count ?? action.server_count ?? 0} />
      <DetailLine label="Client" value={action.client_node_count ?? action.client_count ?? 0} />
      <DetailLine label="Server Endpoint 수" value={action.server_endpoint_count ?? action.server_count ?? 0} />
      <DetailLine label="Client Endpoint 수" value={action.client_endpoint_count ?? action.client_count ?? 0} />
      <DetailLine label="상태 Topic" value={action.status_topic ?? '-'} />
      <DetailLine label="피드백 Topic" value={action.feedback_topic ?? '-'} />
      <p className="detail-help-text">
        Goal 요청자 Node는 Goal을 보내고, Goal 실행자 Node는 Goal을 받아 실행합니다. Dashboard가 Interface Lab
        실행을 위해 만든 Client는 외부 Node 수에서는 제외하고, 요청자 목록에는 내부 실행 주체로 구분해
        표시합니다. Endpoint 수는 Dashboard 통신을 포함한 Graph 원본 진단값입니다.
      </p>
      <ConnectionNodeList emptyText="Goal 실행자 Node 없음" items={participants?.servers ?? []} title="Goal 실행자 Node" />
      <ConnectionNodeList
        emptyText="Goal 요청자 Node 없음"
        items={withExecutionNode(participants?.clients ?? [], action.dashboard_communication?.execution_node)}
        title="Goal 요청자 Node"
      />
    </DetailSection>
  )
}

export function ActionExecutionSection({ action, goalSummary, presentation, runtime }) {
  return (
    <DetailSection collapsible title="실행/측정 정보">
      <DetailLine label="마지막 Goal 상태" tone={actionStatusTone(presentation.goalStatus)} value={goalStatusLabel(presentation.goalStatus)} />
      <DetailLine
        label="실행 가능"
        tone={action.callable ? 'good' : action.allowlisted ? 'warn' : 'muted'}
        value={action.callable ? '예' : action.allowlisted ? '등록됨' : '아니오'}
      />
      <DetailLine
        label="서버 전송"
        tone={goalSummary?.sent_to_server === false ? 'warn' : 'muted'}
        value={goalSummary ? goalSummary.sent_to_server ? '예' : '아니오' : '-'}
      />
      {goalSummary?.error_type === 'validation_error' && (
        <p className="notice-text warning">The payload does not match the Action type. No goal was sent to the server.</p>
      )}
      <DetailLine label="마지막 Goal ID" value={runtime.last_goal_id ?? '-'} />
      <DetailLine label="마지막 상태 수신" value={formatRelativeTime(runtime.last_status_at)} />
      <DetailLine label="마지막 피드백" value={formatRelativeTime(presentation.lastFeedbackAt)} />
      <DetailLine label="실행 시간" value={formatMs(presentation.executionTimeMs)} />
      <DetailLine label="관찰 Goal 수" value={presentation.observedGoalCount} />
      <DetailLine
        label="결과 상태"
        tone={actionStatusTone(presentation.result.value)}
        value={resultStatusLabel(presentation.result.value)}
      />
      <DetailLine label="결과 오류" value={runtime.result_error ?? '-'} />
      <DetailLine label="마지막 실행 오류" value={goalSummary?.last_error ?? '-'} />
      <DetailLine label="Goal 수" value={action.goal_count ?? 0} />
      <DetailLine label="성공/실패" value={`${action.success_count ?? 0}/${action.failure_count ?? 0}`} />
    </DetailSection>
  )
}
