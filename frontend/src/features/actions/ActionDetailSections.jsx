import { ConnectionNodeList } from '../../components/ConnectionNodeList.jsx'
import { DetailSection } from '../../components/DetailSection.jsx'
import { formatMs, formatRelativeTime } from '../../utils/format.js'
import { withExecutionNode } from '../../utils/participants.js'
import {
  actionStatusTone,
  goalStatusLabel,
  resultLabel,
  resultPolicyLabel,
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
      <DetailLine label="Server Node 수 (Dashboard 제외)" value={action.server_node_count ?? action.server_count ?? 0} />
      <DetailLine label="Client Node 수 (Dashboard 제외)" value={action.client_node_count ?? action.client_count ?? 0} />
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

export function ActionCapabilitySection({ action }) {
  return (
    <DetailSection collapsible title="상세 데이터">
      <p className="muted detail-help-text">
        피드백 구독 지원 여부는 이 Action 타입의 피드백 메시지를 대시보드가 해석할 수 있는지를 의미합니다.
        실제 수신 여부는 실행 정보와 피드백 미리보기에서 확인합니다.
      </p>
      <DetailLine label="상태 구독" value={action.status_supported ? '지원' : '미지원'} />
      <DetailLine label="피드백 구독" value={action.feedback_supported ? '지원' : '미지원'} />
      <DetailLine label="피드백 이유" value={action.feedback_reason ?? '-'} />
      <DetailLine label="결과" value={action.result_supported ? resultLabel(action) : '미지원'} />
      <DetailLine label="결과 조회 정책" value={resultPolicyLabel(action.result_policy)} />
      <DetailLine label="결과 이유" value={action.result_reason ?? '-'} />
    </DetailSection>
  )
}

export function ActionPreviewSections({ goalSummary, runtime }) {
  return (
    <>
      <PreviewSection title="마지막 Goal JSON" value={goalSummary?.last_goal_preview} />
      <PreviewSection title="마지막 Feedback JSON" value={goalSummary?.last_feedback_preview} />
      <PreviewSection title="마지막 Result JSON" value={goalSummary?.last_result_preview} />
      <PreviewSection title="최근 Goal History JSON" value={goalSummary?.history} />
      <PreviewSection title="피드백 미리보기 JSON" value={runtime.feedback_preview} />
      <PreviewSection title="결과 미리보기 JSON" value={runtime.result_preview} />
    </>
  )
}

function PreviewSection({ title, value }) {
  return (
    <DetailSection collapsible title={title}>
      <pre className="preview-json">{value ? JSON.stringify(value, null, 2) : '데이터 없음'}</pre>
    </DetailSection>
  )
}
