import { schemaFields } from '../model/schemaValues.js'
import {
  ConnectionList,
  HistoryList,
  LastResultBlock,
  SectionTitle,
} from './WorkspaceShared.jsx'
import { SchemaRequestField } from '../SchemaRequestField.jsx'
import { QosModeControl } from '../execution/QosModeControl.jsx'

export function ServiceWorkspaceDetail({
  executing,
  inlineResult,
  item,
  onExecute,
  onHistorySelect,
  onReset,
  onRequestChange,
  onRequestQosModeChange,
  onRequestQosProfileChange,
  onResponseQosModeChange,
  onResponseQosProfileChange,
  onTargetChange,
  requestQosMode,
  requestQosProfile,
  requestValues,
  selectedHistoryItem,
  selectedTargetKey,
  responseQosMode,
  responseQosProfile,
  setTimeoutSec,
  timeoutSec,
  view,
}) {
  const callableServices = item.connectedServices?.filter((service) => service.callable) ?? []
  const callableTarget = callableServices.find((service) => resourceKey(service) === selectedTargetKey)
    ?? (item.kind === 'callable_service' ? item.status : null)
  return (
    <>
      {(view === 'details' || view === 'advanced') && <><SectionTitle title="Graph 연결" /><ConnectionList
        empty="이 타입으로 열린 Service가 없습니다."
        items={item.connectedServices}
        render={(service) => `${service.service_name || '서버 없음'} · servers ${service.server_count ?? 0} · ${service.callable ? '실행 가능' : service.reason ?? '실행 불가'}`}
      /></>}
      {view === 'execute' && <><SectionTitle title={callableTarget?.service_name ?? 'Service Call'} />
      {callableTarget ? (
        <>
          {callableServices.length > 1 && <label className="interface-service-field">
            <span>실행 Service</span>
            <select onChange={(event) => onTargetChange(event.target.value)} value={selectedTargetKey}>
              {callableServices.map((service) => <option key={resourceKey(service)} value={resourceKey(service)}>Domain {service.domain_id} · {service.service_name}</option>)}
            </select>
          </label>}
          {schemaFields(item.schema).map((field) => (
            <SchemaRequestField
              field={field}
              key={field.name ?? field.raw_line}
              onChange={(value) => onRequestChange((current) => ({
                ...current,
                [field.name]: value,
              }))}
              value={requestValues[field.name]}
            />
          ))}
          <QosModeControl groups={[{ key: 'request', label: 'Request QoS', profile: requestQosProfile, onChange: onRequestQosProfileChange }]} mode={requestQosMode} onModeChange={onRequestQosModeChange} />
          <QosModeControl groups={[{ key: 'response', label: 'Response QoS', profile: responseQosProfile, onChange: onResponseQosProfileChange }]} mode={responseQosMode} onModeChange={onResponseQosModeChange} />
          <details className="interface-advanced-section"><summary>고급 설정</summary><label className="interface-service-field">
            <span>timeout_sec</span>
            <input
              min="0.1"
              onChange={(event) => setTimeoutSec(Number(event.target.value))}
              step="0.1"
              type="number"
              value={timeoutSec}
            />
          </label></details>
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
      </>}
      {view === 'history' && <HistoryList
        empty="최근 호출 이력이 없습니다."
        items={item.history}
        onSelect={onHistorySelect}
        onReset={onReset}
        selected={selectedHistoryItem}
        type="service"
      />}
    </>
  )
}

function resourceKey(service) {
  return service.resource_key ?? `${service.domain_id}:${service.service_name}`
}
