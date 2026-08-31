import { CallResultBlock, ReceiveHistory } from '../InterfaceExecutionShared.jsx'
import { SchemaRequestField } from '../SchemaRequestField.jsx'
import { serviceKey } from '../model/interfaceUploadModel.js'
import { ExecutionPanelHeading } from '../execution/ExecutionPanelHeading.jsx'
import { ServerSchemaSummary } from './ServerSchemaSummary.jsx'

export function ServiceServerPanel({
  active = false,
  activeServer,
  busy = false,
  calls = [],
  domainIds = [],
  expanded = false,
  historyBusy = false,
  onClose,
  onDomainChange = () => {},
  onFieldChange = () => {},
  onRefreshHistory = () => {},
  onResetHistory = () => {},
  onSelect = () => {},
  onServiceNameChange = () => {},
  onStart = () => {},
  onStop = () => {},
  onToggleExpanded = () => {},
  responseValues = {},
  result,
  selected,
  selectedDomainId = null,
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
        <div className="interface-server-grid">
          <div className="interface-server-form-column">
            <label className="interface-service-field">
              <span>Domain</span>
              <select disabled={busy} onChange={(event) => onDomainChange(event.target.value)} value={selectedDomainId ?? ''}>
                <option value="">Domain 선택</option>
                {domainIds.map((domainId) => <option key={domainId} value={domainId}>D{domainId}</option>)}
              </select>
            </label>
            <label className="interface-service-field">
              <span>Service type · D{selectedDomainId ?? '-'}</span>
              <select disabled={busy} onChange={(event) => onSelect(event.target.value)} value={selectedKey}>
                <option value="">개설 Service 타입 선택</option>
                {visibleServices.map((service) => (
                  <option key={serviceKey(service)} value={serviceKey(service)}>
                    {service.service_type}
                  </option>
                ))}
              </select>
              {!visibleServices.length && <small>선택 Domain에 import 가능한 Service 타입이 없습니다.</small>}
            </label>
            <label className="interface-service-field">
              <span>개설 Service name</span>
              <input
                placeholder="/interface_lab_service_server"
                value={serverName}
                disabled={busy}
                onChange={(event) => onServiceNameChange(event.target.value)}
              />
              {serverDomainId !== null && <small>개설 Domain {serverDomainId}</small>}
            </label>
            {selected && (
              <div className="interface-package-help">
                Dashboard는 Request/Response 필드의 업무 의미를 해석하지 않고 등록된 ROS2 타입 그대로 통신합니다.
              </div>
            )}
            {selected && <ServerSchemaSummary fields={selected.request_schema} title="Request schema · 실제 Client 수신값" />}
            {selected && <span className="interface-form-section-title">Response 반환 데이터 · 사용자 설정값</span>}
            {selected?.response_schema?.map((field) => (
              <SchemaRequestField
                disabled={!selected?.server_creatable || active}
                field={field}
                key={field.name ?? field.raw_line}
                onChange={(value) => onFieldChange(field.name, value)}
                value={responseValues[field.name]}
              />
            ))}
            <div className="interface-server-actions">
              <button
                className="interface-receive-action-button primary"
                disabled={active || busy || !selected?.server_creatable || !serverName.trim()}
                onClick={onStart}
                type="button"
              >
                {busy && !active ? '개설 중…' : '서버 개설 시작'}
              </button>
              <button
                className="interface-receive-action-button warning"
                disabled={!active || busy}
                onClick={onStop}
                type="button"
              >
                {busy && active ? '종료 중…' : '서버 종료'}
              </button>
            </div>
            <div className={`interface-service-state ${active ? 'success' : 'warning'}`}>
              {active
                ? `서버 실행 중 · D${activeServer?.domain_id} · ${activeServer?.service_name} · ${activeServer?.service_type}`
                : '서버 중지됨'}
            </div>
          </div>

          <div className="interface-server-receive-column">
            <div className="interface-server-receive-header">
              <strong>서버 수신 및 응답 이력</strong>
              <div className="interface-receive-actions">
                <button
                  className="interface-receive-action-button warning"
                  disabled={historyBusy || busy || !selected || !serverName.trim()}
                  onClick={onResetHistory}
                  type="button"
                >
                  {historyBusy ? '처리 중…' : '이력 리셋'}
                </button>
                <button
                  className="interface-receive-action-button ghost"
                  disabled={historyBusy || busy}
                  onClick={onRefreshHistory}
                  type="button"
                >
                  {historyBusy ? '조회 중…' : '새로고침'}
                </button>
              </div>
            </div>
            {result && <CallResultBlock result={result} successPayload={result.server ?? result.stopped} />}
            <ReceiveHistory
              fullItem
              items={calls}
              title="Request / Response history"
            />
          </div>
        </div>
      ) : (
        <small>registry에 등록된 Service가 없습니다.</small>
      )}
    </div>
  )
}
