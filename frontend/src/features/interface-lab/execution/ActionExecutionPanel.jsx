import {
  ActionGoalHistory,
  ActionGoalResult,
} from '../InterfaceExecutionShared.jsx'
import { SchemaRequestField } from '../SchemaRequestField.jsx'
import { actionKey, actionStatusLabel } from '../model/interfaceUploadModel.js'
import { ExecutionPanelHeading } from './ExecutionPanelHeading.jsx'
import { ActionQosControl } from './ActionQosControl.jsx'

export function ActionExecutionPanel({
  actionName = '',
  actions = [],
  busy,
  domainIds = [],
  expanded,
  goalValues = {},
  goals = [],
  graphCandidates = [],
  modeLinked,
  onActionNameChange = () => {},
  onClose,
  onDomainChange = () => {},
  onExecute,
  onFieldChange,
  onModeLinkChange,
  onSelect,
  onTimeoutChange,
  onToggleExpanded,
  qosControls,
  result,
  selected,
  selectedDomainId = null,
  selectedKey,
  showExpand,
  timeoutSec,
  visibleActions = [],
}) {
  return (
    <div className="interface-service-panel interface-execution-panel">
      <ExecutionPanelHeading expanded={expanded} onClose={onClose} onToggleExpanded={onToggleExpanded} showExpand={showExpand} title="Action Goal" />
      {actions.length ? (
        <>
          <label className="interface-service-field">
            <span>Domain</span>
            <select onChange={(event) => onDomainChange(event.target.value)} value={selectedDomainId ?? ''}>
              <option value="">Domain 선택</option>
              {domainIds.map((domainId) => <option key={domainId} value={domainId}>D{domainId}</option>)}
            </select>
          </label>
          <label className="interface-service-field">
            <span>Action type · D{selectedDomainId ?? '-'}</span>
            <select onChange={(event) => onSelect(event.target.value)} value={selectedKey}>
              <option value="">Goal Action 타입 선택</option>
              {visibleActions.map((action) => (
                <option key={actionKey(action)} value={actionKey(action)}>
                  {action.action_type}
                </option>
              ))}
            </select>
            {!visibleActions.length && <small>선택 Domain에 import 가능한 Action 타입이 없습니다.</small>}
          </label>
          {graphCandidates.length > 0 && (
            <label className="interface-service-field">
              <span>기존 Graph Action 후보</span>
              <select
                onChange={(event) => onActionNameChange(event.target.value)}
                value={graphCandidates.some((a) => a.action_name === actionName) ? actionName : ''}
              >
                <option value="">직접 입력 또는 후보 선택</option>
                {graphCandidates.map((action) => (
                  <option key={action.resource_key} value={action.action_name}>
                    {action.action_name} · D{action.domain_id} · {actionStatusLabel(action)}
                  </option>
                ))}
              </select>
              <small>Graph에 등록된 Action을 선택하거나 아래에서 직접 이름을 수정하세요.</small>
            </label>
          )}
          <label className="interface-service-field">
            <span>Goal Action name</span>
            <input
              placeholder="/action_name"
              value={actionName}
              onChange={(event) => onActionNameChange(event.target.value)}
            />
          </label>
          {selected && <div className={`interface-service-state ${selected.callable ? 'success' : 'warning'}`}>{actionStatusLabel(selected)}{selected.reason ? ` · ${selected.reason}` : ''}</div>}
          {selected && <div className="interface-package-help">선택 타입 {selected.action_type}의 Goal schema {selected.goal_schema?.length ?? 0}개 필드로 폼을 생성합니다.</div>}
          <ActionQosControl controls={qosControls} modeLinked={modeLinked} onModeLinkChange={onModeLinkChange} />
          {selected?.goal_schema?.map((field) => (
            <SchemaRequestField disabled={!selected?.callable} field={field} key={field.name ?? field.raw_line} onChange={(value) => onFieldChange(field.name, value)} value={goalValues[field.name]} />
          ))}
          <label className="interface-service-field">
            <span>timeout_sec</span>
            <input disabled={!selected?.callable} min="0.1" onChange={(event) => onTimeoutChange(Number(event.target.value))} step="0.1" type="number" value={timeoutSec} />
          </label>
          <button className="interface-service-call-button" disabled={busy || !selected?.callable} onClick={onExecute} type="button">{busy ? '요청 전송 중…' : 'Goal 실행'}</button>
          {result && <ActionGoalResult result={result} />}
          <ActionGoalHistory goals={goals} />
        </>
      ) : <small>registry에 등록된 Action이 없습니다.</small>}
    </div>
  )
}
