import {
  CallResultBlock,
  ServiceCallHistory,
} from '../InterfaceExecutionShared.jsx'
import { SchemaRequestField } from '../SchemaRequestField.jsx'
import { serviceStatusLabel } from '../model/interfaceUploadModel.js'
import { ExecutionPanelHeading } from './ExecutionPanelHeading.jsx'
import { QosModeControl } from './QosModeControl.jsx'

export function ServiceExecutionPanel({
  busy,
  calls = [],
  domainIds = [],
  expanded,
  graphCandidates = [],
  modeLinked,
  onClose,
  onDomainChange = () => {},
  onExecute,
  onFieldChange,
  onModeLinkChange,
  onRequestQosModeChange,
  onRequestQosProfileChange,
  onSelect,
  onServiceNameChange = () => {},
  onTimeoutChange,
  onToggleExpanded,
  requestQosMode,
  requestQosProfile,
  requestValues,
  result,
  selected,
  selectedDomainId = null,
  selectedKey,
  serviceName = '',
  services = [],
  showExpand,
  timeoutSec,
  visibleServices = [],
}) {
  return (
    <div className="interface-service-panel interface-execution-panel">
      <ExecutionPanelHeading expanded={expanded} onClose={onClose} onToggleExpanded={onToggleExpanded} showExpand={showExpand} title="Service 호출" />
      {services.length ? (
        <>
          <label className="interface-service-field">
            <span>Domain</span>
            <select onChange={(event) => onDomainChange(event.target.value)} value={selectedDomainId ?? ''}>
              <option value="">Domain 선택</option>
              {domainIds.map((domainId) => <option key={domainId} value={domainId}>D{domainId}</option>)}
            </select>
          </label>
          <label className="interface-service-field">
            <span>Service type · D{selectedDomainId ?? '-'}</span>
            <select onChange={(event) => onSelect(event.target.value)} value={selectedKey}>
              <option value="">호출 Service 타입 선택</option>
              {visibleServices.map((service) => (
                <option key={service.service_type} value={service.service_type}>
                  {service.service_type}
                </option>
              ))}
            </select>
            {!visibleServices.length && <small>선택 Domain에 import 가능한 Service 타입이 없습니다.</small>}
          </label>
          {graphCandidates.length > 0 && (
            <label className="interface-service-field">
              <span>기존 Graph Service 후보</span>
              <select
                onChange={(event) => onServiceNameChange(event.target.value)}
                value={graphCandidates.some((s) => s.service_name === serviceName) ? serviceName : ''}
              >
                <option value="">직접 입력 또는 후보 선택</option>
                {graphCandidates.map((service) => (
                  <option key={service.resource_key} value={service.service_name}>
                    {service.service_name} · D{service.domain_id} · {serviceStatusLabel(service)}
                  </option>
                ))}
              </select>
              <small>Graph에 등록된 Service를 선택하거나 아래에서 직접 이름을 수정하세요.</small>
            </label>
          )}
          <label className="interface-service-field">
            <span>호출 Service name</span>
            <input
              placeholder="/service_name"
              value={serviceName}
              onChange={(event) => onServiceNameChange(event.target.value)}
            />
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
            <SchemaRequestField disabled={!selected?.callable} field={field} key={field.name ?? field.raw_line} onChange={(value) => onFieldChange(field.name, value)} value={requestValues[field.name]} />
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
