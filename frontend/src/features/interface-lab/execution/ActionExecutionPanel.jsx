import {
  ActionGoalHistory,
  ActionGoalResult,
} from '../InterfaceExecutionShared.jsx'
import { SchemaRequestField } from '../SchemaRequestField.jsx'
import { actionKey, actionStatusLabel } from '../model/interfaceUploadModel.js'
import { ExecutionPanelHeading } from './ExecutionPanelHeading.jsx'
import { ActionQosControl } from './ActionQosControl.jsx'

export function ActionExecutionPanel({
  actions,
  busy,
  expanded,
  goals,
  goalValues,
  importableOnly,
  modeLinked,
  onExecute,
  onFieldChange,
  onImportableOnlyChange,
  onModeLinkChange,
  onClose,
  onSelect,
  onTimeoutChange,
  onToggleExpanded,
  qosControls = [],
  result,
  selected,
  selectedKey,
  showExpand,
  timeoutSec,
  visibleActions,
}) {
  return (
    <div className="interface-service-panel interface-execution-panel">
      <ExecutionPanelHeading expanded={expanded} onClose={onClose} onToggleExpanded={onToggleExpanded} showExpand={showExpand} title="Action Goal" />
      {actions.length ? (
        <>
          <label className="interface-filter-check">
            <input checked={importableOnly} onChange={(event) => onImportableOnlyChange(event.target.checked)} type="checkbox" />
            <span>import된 액션만 보기</span><small>{visibleActions.length}/{actions.length}</small>
          </label>
          <label className="interface-service-field">
            <span>Action · {visibleActions.length}/{actions.length}개</span>
            <select onChange={(event) => onSelect(event.target.value)} value={selectedKey}>
              <option value="">Goal Action 선택</option>
              {visibleActions.map((action) => (
                <option key={actionKey(action)} value={actionKey(action)}>
                  {action.action_name} · D{action.domain_id} · {action.action_type} · {action.import_available ? 'import됨' : 'import 안됨'} · {actionStatusLabel(action)}
                </option>
              ))}
            </select>
            {!visibleActions.length && <small>import된 액션 항목이 없습니다. 적용하기 또는 import 확인 후 다시 시도하세요.</small>}
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
