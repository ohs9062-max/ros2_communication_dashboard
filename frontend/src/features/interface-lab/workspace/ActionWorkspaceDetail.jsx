import { formatTime } from '../model/executionHistory.js'
import { schemaFields } from '../model/schemaValues.js'
import {
  ConnectionList,
  HistoryList,
  LastResultBlock,
  RequestField,
  SectionTitle,
} from './WorkspaceShared.jsx'

export function ActionWorkspaceDetail({
  cancelingGoal,
  executing,
  goalTimeoutSec,
  goalValues,
  inlineResult,
  item,
  onExecute,
  onCancel,
  onGoalChange,
  onHistorySelect,
  selectedHistoryItem,
  setGoalTimeoutSec,
}) {
  const callableTarget = item.connectedActions?.find((action) => action.callable)
    ?? (item.kind === 'callable_action' ? item.status : null)
  return (
    <>
      <SectionTitle title="연결된 Graph Action" />
      <ConnectionList
        empty="이 타입으로 열린 Action이 없습니다."
        items={item.connectedActions}
        render={(action) => [
          `action name ${action.action_name || '서버 없음'}`,
          `graph type ${action.graph_type ?? action.action_type ?? '-'}`,
          `selected/import type ${action.selected_import_type ?? action.full_type ?? item.fullType ?? '-'}`,
          `exact-type servers ${action.server_count ?? 0}`,
          (action.executable ?? action.callable)
            ? 'exact-type 실행 가능'
            : action.reason ?? 'exact-type 실행 불가',
        ].join(' · ')}
      />
      <SectionTitle title="Goal 입력 폼" />
      {callableTarget ? (
        <>
          {schemaFields(item.schema).map((field) => (
            <RequestField
              field={field}
              key={field.name ?? field.raw_line}
              onChange={(value) => onGoalChange((current) => ({
                ...current,
                [field.name]: value,
              }))}
              value={goalValues[field.name]}
            />
          ))}
          <label className="interface-service-field">
            <span>timeout_sec</span>
            <input
              min="0.1"
              onChange={(event) => setGoalTimeoutSec(Number(event.target.value))}
              step="0.1"
              type="number"
              value={goalTimeoutSec}
            />
          </label>
          <button
            className="interface-service-call-button"
            disabled={executing || !callableTarget.callable}
            onClick={onExecute}
            type="button"
          >
            {executing ? '요청 전송 중…' : `${callableTarget.action_name} Goal 실행`}
          </button>
          <button
            className="interface-service-call-button"
            disabled={!executing || cancelingGoal}
            onClick={onCancel}
            type="button"
          >
            {cancelingGoal ? '취소 요청 중…' : '활성 Goal 취소'}
          </button>
        </>
      ) : (
        <p className="muted">import됐고 서버가 있는 Action이 있을 때 Goal 폼이 활성화됩니다.</p>
      )}
      <LastResultBlock fallback={item.lastRun} result={inlineResult} title="마지막 실행 결과" />
      <SectionTitle title="Action 관련 Topic" />
      <ConnectionList
        empty="관련 action topic이 아직 snapshot에 없습니다."
        items={item.connectedTopics}
        render={(topic) => `${topic.name} · ${topic.type ?? topic.types?.[0] ?? '-'} · ${topic.last_received_at ? `last ${formatTime(topic.last_received_at)}` : '아직 수신 없음'} · count ${topic.message_count ?? topic.received_count ?? 0}`}
      />
      <HistoryList
        empty="최근 Goal 이력이 없습니다."
        items={item.history}
        onSelect={onHistorySelect}
        selected={selectedHistoryItem}
        type="action"
      />
    </>
  )
}
