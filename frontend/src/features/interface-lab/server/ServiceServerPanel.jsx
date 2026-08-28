import { CallResultBlock, ReceiveHistory } from '../InterfaceExecutionShared.jsx'
import { SchemaRequestField } from '../SchemaRequestField.jsx'
import { serviceKey, serviceStatusLabel } from '../model/interfaceUploadModel.js'
import { ExecutionPanelHeading } from '../execution/ExecutionPanelHeading.jsx'

export function ServiceServerPanel({
  active = false,
  busy = false,
  calls = [],
  expanded = false,
  importableOnly = false,
  onClose,
  onFieldChange = () => {},
  onImportableOnlyChange = () => {},
  onSelect = () => {},
  onServiceNameChange = () => {},
  onStart = () => {},
  onStop = () => {},
  onToggleExpanded = () => {},
  responseValues = {},
  result,
  selected,
  selectedKey = '',
  serverDomainId = null,
  serverName = '',
  services = [],
  showExpand = false,
  visibleServices = [],
}) {
  return (
    <div className="interface-service-panel interface-execution-panel interface-server-panel">
      <ExecutionPanelHeading
        expanded={expanded}
        onClose={onClose}
        onToggleExpanded={onToggleExpanded}
        showExpand={showExpand}
        title="Service 서버 개설 (요청 수신/응답 대기)"
      />
      {services.length ? (
        <>
          <label className="interface-filter-check">
            <input
              checked={importableOnly}
              onChange={(event) => onImportableOnlyChange(event.target.checked)}
              type="checkbox"
            />
            <span>import된 서비스만 보기</span>
            <small>{visibleServices.length}/{services.length}</small>
          </label>
          <label className="interface-service-field">
            <span>Service · {visibleServices.length}/{services.length}개</span>
            <select onChange={(event) => onSelect(event.target.value)} value={selectedKey}>
              <option value="">개설 Service 타입 선택</option>
              {visibleServices.map((service) => (
                <option key={serviceKey(service)} value={serviceKey(service)}>
                  {service.service_name || service.service_type} · D{service.domain_id ?? 0} · {service.service_type} · {service.import_available ? 'import됨' : 'import 안됨'}
                </option>
              ))}
            </select>
            {!visibleServices.length && <small>import된 서비스 항목이 없습니다. 적용하기 또는 import 확인 후 다시 시도하세요.</small>}
          </label>
          {selected && (
            <div className={`interface-service-state ${selected.server_creatable ? 'success' : 'warning'}`}>
              {selected.server_creatable ? '서버 개설 가능' : serviceStatusLabel(selected)}
            </div>
          )}
          <label className="interface-service-field">
            <span>개설 Service name</span>
            <input
              placeholder="/interface_lab_service_server"
              value={serverName}
              disabled={active}
              onChange={(event) => onServiceNameChange(event.target.value)}
            />
            {serverDomainId !== null && <small>개설 Domain {serverDomainId}</small>}
          </label>
          {selected && (
            <div className="interface-package-help">
              선택 타입 {selected.service_type}의 Response schema {selected.response_schema?.length ?? 0}개 필드로 클라이언트 요청 시 반환할 응답 데이터를 구성합니다.
            </div>
          )}
          {selected?.response_schema?.map((field) => (
            <SchemaRequestField
              disabled={!selected?.server_creatable || active}
              field={field}
              key={field.name ?? field.raw_line}
              onChange={(value) => onFieldChange(field.name, value)}
              value={responseValues[field.name]}
            />
          ))}
          <div className="interface-receive-actions">
            <button
              className={active ? 'interface-receive-action-button warning' : 'interface-service-call-button'}
              disabled={busy || !selected?.server_creatable || !serverName.trim()}
              onClick={active ? onStop : onStart}
              type="button"
            >
              {busy ? '처리 중…' : active ? '서버 개설 중지' : '서버 개설 시작'}
            </button>
          </div>
          {active && (
            <div className="interface-service-state success">
              Service 서버 개설 실행 중 · {serverName || selected?.service_name || selected?.service_type}
            </div>
          )}
          {result && <CallResultBlock result={result} successPayload={result.server ?? result.stopped} />}
          <ReceiveHistory items={calls} title="최근 Service 요청" />
        </>
      ) : (
        <small>registry에 등록된 Service가 없습니다.</small>
      )}
    </div>
  )
}
