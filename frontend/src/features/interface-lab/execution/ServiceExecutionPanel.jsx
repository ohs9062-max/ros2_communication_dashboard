import {
  CallResultBlock,
  RequestField,
  ServiceCallHistory,
} from '../InterfaceExecutionShared.jsx'
import { serviceKey, serviceStatusLabel } from '../model/interfaceUploadModel.js'
import { ExecutionPanelHeading } from './ExecutionPanelHeading.jsx'
import { QosModeControl } from './QosModeControl.jsx'

export function ServiceExecutionPanel({
  busy,
  calls,
  importableOnly,
  modeLinked,
  onExecute,
  onFieldChange,
  onImportableOnlyChange,
  onModeLinkChange,
  onClose,
  onRequestQosModeChange,
  onRequestQosProfileChange,
  onSelect,
  onTimeoutChange,
  onToggleExpanded,
  requestValues,
  result,
  requestQosMode,
  requestQosProfile,
  selected,
  selectedKey,
  services,
  showExpand,
  timeoutSec,
  visibleServices,
  expanded,
}) {
  return (
    <div className="interface-service-panel interface-execution-panel">
      <ExecutionPanelHeading expanded={expanded} onClose={onClose} onToggleExpanded={onToggleExpanded} showExpand={showExpand} title="등록 Service 실행" />
      {services.length ? (
        <>
          <label className="interface-filter-check">
            <input checked={importableOnly} onChange={(event) => onImportableOnlyChange(event.target.checked)} type="checkbox" />
            <span>Service import됨만 보기</span><small>{visibleServices.length}/{services.length}</small>
          </label>
          <label className="interface-service-field">
            <span>Service · {visibleServices.length}/{services.length}개</span>
            <select onChange={(event) => onSelect(event.target.value)} value={selectedKey}>
              {visibleServices.map((service) => (
                <option key={serviceKey(service)} value={serviceKey(service)}>
                  {service.import_available ? 'import됨' : 'import 안됨'} · {serviceStatusLabel(service)} · {service.service_name || service.file_name} · {service.service_type}
                </option>
              ))}
            </select>
            {!visibleServices.length && <small>Service import됨 항목이 없습니다. 적용하기 또는 import-check 이후 다시 확인하세요.</small>}
          </label>
          {selected && <div className={`interface-service-state ${selected.callable ? 'success' : 'warning'}`}>{serviceStatusLabel(selected)}{selected.reason ? ` · ${selected.reason}` : ''}</div>}
          {selected && <div className="interface-package-help">선택 타입 {selected.service_type}의 Request schema {selected.request_schema?.length ?? 0}개 필드로 폼을 생성합니다.</div>}
          <QosModeControl
            groups={[{ key: 'request', label: 'Service 실행 QoS · Request', profile: requestQosProfile, onChange: onRequestQosProfileChange }]}
            mode={requestQosMode}
            modeLinked={modeLinked}
            onModeChange={onRequestQosModeChange}
            onModeLinkChange={onModeLinkChange}
          />
          {selected?.request_schema?.map((field) => (
            <RequestField disabled={!selected?.callable} field={field} key={field.name ?? field.raw_line} onChange={(value) => onFieldChange(field.name, value)} value={requestValues[field.name]} />
          ))}
          <label className="interface-service-field">
            <span>timeout_sec</span>
            <input disabled={!selected?.callable} min="0.1" onChange={(event) => onTimeoutChange(Number(event.target.value))} step="0.1" type="number" value={timeoutSec} />
          </label>
          <button className="interface-service-call-button" disabled={busy || !selected?.callable} onClick={onExecute} type="button">{busy ? '실행 중…' : '실행'}</button>
          {result && <CallResultBlock result={result} successPayload={result.response} />}
          <ServiceCallHistory calls={calls} />
        </>
      ) : <small>registry에 등록된 Service가 없습니다.</small>}
    </div>
  )
}
