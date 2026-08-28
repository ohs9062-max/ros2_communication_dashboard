import { CallResultBlock, ReceiveHistory } from '../InterfaceExecutionShared.jsx'
import { SchemaRequestField } from '../SchemaRequestField.jsx'
import { actionKey, actionStatusLabel } from '../model/interfaceUploadModel.js'
import { ExecutionPanelHeading } from '../execution/ExecutionPanelHeading.jsx'

export function ActionServerPanel({
  acceptCancels = true,
  acceptGoals = true,
  actionName = '',
  actions = [],
  active = false,
  busy = false,
  expanded = false,
  feedbackValues = {},
  goals = [],
  importableOnly = false,
  onActionNameChange = () => {},
  onAcceptCancelsChange = () => {},
  onAcceptGoalsChange = () => {},
  onClose,
  onFieldChange = () => {},
  onImportableOnlyChange = () => {},
  onResultDelayChange = () => {},
  onSelect = () => {},
  onStart = () => {},
  onStop = () => {},
  onToggleExpanded = () => {},
  result,
  resultDelaySec = 1,
  resultValues = {},
  selected,
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
        <>
          <label className="interface-filter-check">
            <input
              checked={importableOnly}
              onChange={(event) => onImportableOnlyChange(event.target.checked)}
              type="checkbox"
            />
            <span>import된 액션만 보기</span>
            <small>{visibleActions.length}/{actions.length}</small>
          </label>
          <label className="interface-service-field">
            <span>Result 반환 대기 · 초</span>
            <input disabled={active} min="0" max="60" step="0.1" type="number" value={resultDelaySec} onChange={(event) => onResultDelayChange(Number(event.target.value))} />
            <small>대기 중 Cancel 요청을 처리하며, 0이면 즉시 Feedback/Result를 반환합니다.</small>
          </label>
          <label className="interface-service-field">
            <span>Action · {visibleActions.length}/{actions.length}개</span>
            <select onChange={(event) => onSelect(event.target.value)} value={selectedKey}>
              <option value="">개설 Action 타입 선택</option>
              {visibleActions.map((action) => (
                <option key={actionKey(action)} value={actionKey(action)}>
                  {action.action_name || action.action_type} · D{action.domain_id ?? 0} · {action.action_type} · {action.import_available ? 'import됨' : 'import 안됨'}
                </option>
              ))}
            </select>
            {!visibleActions.length && <small>import된 액션 항목이 없습니다. 적용하기 또는 import 확인 후 다시 시도하세요.</small>}
          </label>
          {selected && (
            <div className={`interface-service-state ${selected.server_creatable ? 'success' : 'warning'}`}>
              {selected.server_creatable ? '서버 개설 가능' : actionStatusLabel(selected)}
            </div>
          )}
          <label className="interface-service-field">
            <span>개설 Action name</span>
            <input
              placeholder="/interface_lab_action_server"
              value={actionName}
              disabled={active}
              onChange={(event) => onActionNameChange(event.target.value)}
            />
            {serverDomainId !== null && <small>개설 Domain {serverDomainId}</small>}
          </label>
          {selected && (
            <div className="interface-package-help">
              선택 타입 {selected.action_type}의 Result schema {selected.result_schema?.length ?? 0}개 및 Feedback schema {selected.feedback_schema?.length ?? 0}개 필드로 응답 데이터를 구성합니다.
            </div>
          )}
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
          <div className="interface-receive-actions">
            <button
              className={active ? 'interface-receive-action-button warning' : 'interface-service-call-button'}
              disabled={busy || !selected?.server_creatable || !actionName.trim()}
              onClick={active ? onStop : onStart}
              type="button"
            >
              {busy ? '처리 중…' : active ? '서버 개설 중지' : '서버 개설 시작'}
            </button>
          </div>
          {active && (
            <div className="interface-service-state success">
              Action 서버 개설 실행 중 · {actionName || selected?.action_name || selected?.action_type}
            </div>
          )}
          {result && <CallResultBlock result={result} successPayload={result.server ?? result.stopped} />}
          <ReceiveHistory items={goals} title="최근 Goal/Cancel/Result" />
        </>
      ) : (
        <small>registry에 등록된 Action이 없습니다.</small>
      )}
    </div>
  )
}
