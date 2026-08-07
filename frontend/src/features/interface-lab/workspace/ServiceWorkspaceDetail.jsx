import { schemaFields } from '../model/schemaValues.js'
import {
  ConnectionList,
  HistoryList,
  LastResultBlock,
  RequestField,
  SectionTitle,
} from './WorkspaceShared.jsx'

export function ServiceWorkspaceDetail({
  executing,
  inlineResult,
  item,
  onExecute,
  onHistorySelect,
  onRequestChange,
  requestValues,
  selectedHistoryItem,
  setTimeoutSec,
  timeoutSec,
}) {
  const callableTarget = item.connectedServices?.find((service) => service.callable)
    ?? (item.kind === 'callable_service' ? item.status : null)
  return (
    <>
      <SectionTitle title="연결된 Graph Service" />
      <ConnectionList
        empty="이 타입으로 열린 Service가 없습니다."
        items={item.connectedServices}
        render={(service) => `${service.service_name || '서버 없음'} · servers ${service.server_count ?? 0} · ${service.callable ? '실행 가능' : service.reason ?? '실행 불가'}`}
      />
      <SectionTitle title="실행 폼" />
      {callableTarget ? (
        <>
          {schemaFields(item.schema).map((field) => (
            <RequestField
              field={field}
              key={field.name ?? field.raw_line}
              onChange={(value) => onRequestChange((current) => ({
                ...current,
                [field.name]: value,
              }))}
              value={requestValues[field.name]}
            />
          ))}
          <label className="interface-service-field">
            <span>timeout_sec</span>
            <input
              min="0.1"
              onChange={(event) => setTimeoutSec(Number(event.target.value))}
              step="0.1"
              type="number"
              value={timeoutSec}
            />
          </label>
          <button
            className="interface-service-call-button"
            disabled={executing || !callableTarget.callable}
            onClick={onExecute}
            type="button"
          >
            {executing ? '실행 중…' : `${callableTarget.service_name} 실행`}
          </button>
        </>
      ) : (
        <p className="muted">import됐고 서버가 있는 Service가 있을 때 실행 폼이 활성화됩니다.</p>
      )}
      <LastResultBlock fallback={item.lastRun} result={inlineResult} title="마지막 호출 결과" />
      <HistoryList
        empty="최근 호출 이력이 없습니다."
        items={item.history}
        onSelect={onHistorySelect}
        selected={selectedHistoryItem}
        type="service"
      />
    </>
  )
}
