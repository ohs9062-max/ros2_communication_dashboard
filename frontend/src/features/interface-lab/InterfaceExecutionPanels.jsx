import {
  ActionGoalHistory,
  ActionGoalResult,
  CallResultBlock,
  ReceiveHistory,
  RequestField,
  ServiceCallHistory,
} from './InterfaceExecutionShared.jsx'
import {
  actionKey,
  actionStatusLabel,
  messageKey,
  serviceKey,
  serviceStatusLabel,
  topicGraphStatusLabel,
  topicStatusLabel,
} from './model/interfaceUploadModel.js'

function PanelHeading({ expanded, onToggleExpanded, showExpand, title }) {
  return (
    <div className="interface-registry-heading interface-panel-heading">
      <strong>{title}</strong>
      {showExpand && (
        <button aria-pressed={expanded} className="interface-panel-expand-button" onClick={onToggleExpanded} type="button">
          {expanded ? '목록보기' : '크게보기'}
        </button>
      )}
    </div>
  )
}

export function TopicExecutionPanel({
  activeContinuousPublish,
  busy,
  expanded,
  history,
  importableOnly,
  messageValues,
  messages,
  onContinuousStart,
  onContinuousStop,
  onFieldChange,
  onHzChange,
  onImportableOnlyChange,
  onPublish,
  onResetHistory,
  onSelect,
  onTopicNameChange,
  onToggleExpanded,
  publishGraphTopics,
  publishName,
  publishResult,
  publishWarning,
  publishHz,
  selected,
  selectedKey,
  showExpand,
  visibleMessages,
}) {
  return (
    <div className="interface-service-panel interface-execution-panel">
      <PanelHeading expanded={expanded} onToggleExpanded={onToggleExpanded} showExpand={showExpand} title="등록 Topic 실행" />
      {messages.length ? (
        <>
          <label className="interface-filter-check">
            <input checked={importableOnly} onChange={(event) => onImportableOnlyChange(event.target.checked)} type="checkbox" />
            <span>Message import됨만 보기</span><small>{visibleMessages.length}/{messages.length}</small>
          </label>
          <label className="interface-service-field">
            <span>Message full_type · {visibleMessages.length}/{messages.length}개</span>
            <select value={selectedKey} onChange={(event) => onSelect(event.target.value)}>
              {visibleMessages.map((message) => (
                <option key={messageKey(message)} value={messageKey(message)}>
                  {message.import_available ? 'import됨' : 'import 안됨'} · {topicStatusLabel(message)} · {topicGraphStatusLabel(message)} · {message.message_type ?? message.full_type}
                </option>
              ))}
            </select>
            {!visibleMessages.length && <small>Message import됨 항목이 없습니다. 적용하기 또는 import-check 이후 다시 확인하세요.</small>}
          </label>
          {selected && (
            <div className={`interface-service-state ${selected.import_available ? 'success' : 'warning'}`}>
              {selected.import_available ? 'import됨' : 'import 안됨'} · {topicStatusLabel(selected)} · {topicGraphStatusLabel(selected)}
              {selected.import_error ? ` · ${selected.import_error}` : ''}
            </div>
          )}
          <label className="interface-service-field">
            <span>기존 Graph Topic 후보</span>
            <select value={publishGraphTopics.some((topic) => topic.name === publishName) ? publishName : ''} onChange={(event) => onTopicNameChange(event.target.value, 'graph')}>
              <option value="">직접 입력</option>
              {publishGraphTopics.map((topic) => <option key={topic.name} value={topic.name}>{topic.name} · {topic.type ?? topic.types?.[0] ?? '-'}</option>)}
            </select>
            <small>선택하면 해당 Topic에 추가 Publisher로 발행합니다. 새 Topic을 만들려면 Publish Topic name을 직접 입력하세요.</small>
          </label>
          <label className="interface-service-field">
            <span>Publish Topic name</span>
            <input placeholder="/interface_lab_topic_test" value={publishName} onChange={(event) => onTopicNameChange(event.target.value, 'user')} />
          </label>
          {selected && <div className="interface-package-help">선택 Message {selected.message_type}의 schema {selected.message_schema?.length ?? 0}개 필드로 payload 폼을 생성합니다. 사용자가 명시적으로 실행할 때만 전송합니다.</div>}
          {publishWarning && <div className="interface-service-state warning">{publishWarning}</div>}
          {selected?.message_schema?.map((field) => (
            <RequestField disabled={!selected?.import_available} field={field} key={field.name ?? field.raw_line} onChange={(value) => onFieldChange(field.name, value)} value={messageValues[field.name]} />
          ))}
          <label className="interface-service-field">
            <span>지속 발행 주기 (Hz)</span>
            <input disabled={Boolean(activeContinuousPublish)} max="50" min="0.1" onChange={(event) => onHzChange(Number(event.target.value))} step="0.1" type="number" value={publishHz} />
          </label>
          <div className="interface-receive-actions">
            <button className="interface-service-call-button" disabled={busy || !selected?.import_available} onClick={onPublish} type="button">{busy ? '처리 중…' : '1회 발행'}</button>
            <button className={activeContinuousPublish ? 'interface-receive-action-button warning' : 'interface-service-call-button'} disabled={busy || !selected?.import_available} onClick={activeContinuousPublish ? onContinuousStop : onContinuousStart} type="button">{activeContinuousPublish ? '지속 발행 중지' : '지속 발행'}</button>
          </div>
          {activeContinuousPublish && <div className="interface-service-state warning">{activeContinuousPublish.hz} Hz로 지속 발행 중 · {activeContinuousPublish.message_count ?? 0}회 전송</div>}
          <div className="interface-receive-actions"><button className="interface-receive-action-button warning" onClick={onResetHistory} type="button">Publish 이력 리셋</button></div>
          {publishResult && <CallResultBlock result={publishResult} successPayload={publishResult.message_json ?? publishResult.payload} />}
          <ReceiveHistory title="Topic publish history" items={history} />
        </>
      ) : <small>registry에 등록된 Message가 없습니다.</small>}
    </div>
  )
}

export function ServiceExecutionPanel({
  busy,
  calls,
  importableOnly,
  onExecute,
  onFieldChange,
  onImportableOnlyChange,
  onSelect,
  onTimeoutChange,
  onToggleExpanded,
  requestValues,
  result,
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
      <PanelHeading expanded={expanded} onToggleExpanded={onToggleExpanded} showExpand={showExpand} title="등록 Service 실행" />
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

export function ActionExecutionPanel({
  actions,
  busy,
  expanded,
  goals,
  goalValues,
  importableOnly,
  onExecute,
  onFieldChange,
  onImportableOnlyChange,
  onSelect,
  onTimeoutChange,
  onToggleExpanded,
  result,
  selected,
  selectedKey,
  showExpand,
  timeoutSec,
  visibleActions,
}) {
  return (
    <div className="interface-service-panel interface-execution-panel">
      <PanelHeading expanded={expanded} onToggleExpanded={onToggleExpanded} showExpand={showExpand} title="등록 Action 실행" />
      {actions.length ? (
        <>
          <label className="interface-filter-check">
            <input checked={importableOnly} onChange={(event) => onImportableOnlyChange(event.target.checked)} type="checkbox" />
            <span>Action import됨만 보기</span><small>{visibleActions.length}/{actions.length}</small>
          </label>
          <label className="interface-service-field">
            <span>Action · {visibleActions.length}/{actions.length}개</span>
            <select onChange={(event) => onSelect(event.target.value)} value={selectedKey}>
              {visibleActions.map((action) => (
                <option key={actionKey(action)} value={actionKey(action)}>
                  {action.import_available ? 'import됨' : 'import 안됨'} · {actionStatusLabel(action)} · {action.action_name || action.file_name} · {action.action_type}
                </option>
              ))}
            </select>
            {!visibleActions.length && <small>Action import됨 항목이 없습니다. 적용하기 또는 import-check 이후 다시 확인하세요.</small>}
          </label>
          {selected && <div className={`interface-service-state ${selected.callable ? 'success' : 'warning'}`}>{actionStatusLabel(selected)}{selected.reason ? ` · ${selected.reason}` : ''}</div>}
          {selected && <div className="interface-package-help">선택 타입 {selected.action_type}의 Goal schema {selected.goal_schema?.length ?? 0}개 필드로 폼을 생성합니다.</div>}
          {selected?.goal_schema?.map((field) => (
            <RequestField disabled={!selected?.callable} field={field} key={field.name ?? field.raw_line} onChange={(value) => onFieldChange(field.name, value)} value={goalValues[field.name]} />
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
