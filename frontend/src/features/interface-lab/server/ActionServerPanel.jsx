import { CallResultBlock, ReceiveHistory } from '../InterfaceExecutionShared.jsx'
import { SchemaRequestField } from '../SchemaRequestField.jsx'
import { actionKey } from '../model/interfaceUploadModel.js'
import { ExecutionPanelHeading } from '../execution/ExecutionPanelHeading.jsx'
import { ServerSchemaSummary } from './ServerSchemaSummary.jsx'

export function ActionServerPanel({
  acceptCancels = true,
  acceptGoals = true,
  actionName = '',
  actions = [],
  active = false,
  activeServer,
  busy = false,
  domainIds = [],
  expanded = false,
  feedbackValues = {},
  goals = [],
  historyBusy = false,
  onActionNameChange = () => {},
  onAcceptCancelsChange = () => {},
  onAcceptGoalsChange = () => {},
  onClose,
  onDomainChange = () => {},
  onFieldChange = () => {},
  onRefreshHistory = () => {},
  onResetHistory = () => {},
  onResultDelayChange = () => {},
  onSelect = () => {},
  onStart = () => {},
  onStop = () => {},
  onToggleExpanded = () => {},
  result,
  resultDelaySec = 1,
  resultValues = {},
  selected,
  selectedDomainId = null,
  selectedKey = '',
  serverDomainId = null,
  showExpand = false,
  visibleActions = [],
}) {
  return (
    <div className="interface-service-panel interface-execution-panel interface-server-panel">
      <ExecutionPanelHeading
        expanded={expanded}
        onClose={onClose}
        onToggleExpanded={onToggleExpanded}
        showExpand={showExpand}
        title="Action 서버 개설 (Goal 수신/Feedback/Result 처리)"
      />
      {actions.length ? (
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
              <span>Result 반환 대기 · 초</span>
              <input disabled={active} min="0" max="60" step="0.1" type="number" value={resultDelaySec} onChange={(event) => onResultDelayChange(Number(event.target.value))} />
              <small>대기 중 Cancel 요청을 처리하며, 0이면 즉시 Feedback/Result를 반환합니다.</small>
            </label>
            <label className="interface-service-field">
              <span>Action type · D{selectedDomainId ?? '-'}</span>
              <select disabled={busy} onChange={(event) => onSelect(event.target.value)} value={selectedKey}>
                <option value="">개설 Action 타입 선택</option>
                {visibleActions.map((action) => (
                  <option key={actionKey(action)} value={actionKey(action)}>
                    {action.action_type}
                  </option>
                ))}
              </select>
              {!visibleActions.length && <small>선택 Domain에 import 가능한 Action 타입이 없습니다.</small>}
            </label>
            <label className="interface-service-field">
              <span>개설 Action name</span>
              <input
                placeholder="/interface_lab_action_server"
                value={actionName}
                disabled={busy}
                onChange={(event) => onActionNameChange(event.target.value)}
              />
              {serverDomainId !== null && <small>개설 Domain {serverDomainId}</small>}
            </label>
            {selected && (
              <div className="interface-package-help">
                Dashboard는 Goal/Feedback/Result 필드의 업무 의미를 해석하지 않고 등록된 ROS2 타입 그대로 통신합니다.
              </div>
            )}
            {selected && <ServerSchemaSummary fields={selected.goal_schema} title="Goal schema · 실제 Client 수신값" />}
            <label className="interface-filter-check">
              <input checked={acceptGoals} disabled={active} onChange={(event) => onAcceptGoalsChange(event.target.checked)} type="checkbox" />
              <span>수신 Goal Accept</span>
              <small>해제하면 Goal을 Reject하고 이력에 남깁니다.</small>
            </label>
            <label className="interface-filter-check">
              <input checked={acceptCancels} disabled={active} onChange={(event) => onAcceptCancelsChange(event.target.checked)} type="checkbox" />
              <span>Cancel 요청 Accept</span>
              <small>해제하면 Cancel 요청을 Reject합니다.</small>
            </label>
            {selected?.result_schema?.length > 0 && (
              <>
                <span className="interface-form-section-title">Result 반환 데이터</span>
                {selected.result_schema.map((field) => (
                  <SchemaRequestField
                    disabled={!selected?.server_creatable || active}
                    field={field}
                    key={`res_${field.name ?? field.raw_line}`}
                    onChange={(value) => onFieldChange('result', field.name, value)}
                    value={resultValues[field.name]}
                  />
                ))}
              </>
            )}
            {selected?.feedback_schema?.length > 0 && (
              <>
                <span className="interface-form-section-title">Feedback 반환 데이터</span>
                {selected.feedback_schema.map((field) => (
                  <SchemaRequestField
                    disabled={!selected?.server_creatable || active}
                    field={field}
                    key={`fb_${field.name ?? field.raw_line}`}
                    onChange={(value) => onFieldChange('feedback', field.name, value)}
                    value={feedbackValues[field.name]}
                  />
                ))}
              </>
            )}
            <div className="interface-server-actions">
              <button
                className="interface-receive-action-button primary"
                disabled={active || busy || !selected?.server_creatable || !actionName.trim()}
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
                ? `서버 실행 중 · D${activeServer?.domain_id} · ${activeServer?.action_name} · ${activeServer?.action_type}`
                : '서버 중지됨'}
            </div>
          </div>

          <div className="interface-server-receive-column">
            <div className="interface-server-receive-header">
              <strong>서버 수신 및 응답 이력</strong>
              <div className="interface-receive-actions">
                <button
                  className="interface-receive-action-button warning"
                  disabled={historyBusy || busy || !selected || !actionName.trim()}
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
              items={goals}
              title="Goal / Feedback / Result / Cancel history"
            />
          </div>
        </div>
      ) : (
        <small>registry에 등록된 Action이 없습니다.</small>
      )}
    </div>
  )
}
