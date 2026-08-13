import {
  CallResultBlock,
  ReceiveHistory,
} from '../InterfaceExecutionShared.jsx'
import { SchemaRequestField } from '../SchemaRequestField.jsx'
import {
  messageKey,
  topicGraphStatusLabel,
  topicStatusLabel,
} from '../model/interfaceUploadModel.js'
import { ExecutionPanelHeading } from './ExecutionPanelHeading.jsx'
import { QosModeControl } from './QosModeControl.jsx'

export function TopicExecutionPanel({
  activeContinuousPublish,
  busy,
  expanded,
  history,
  importableOnly,
  messageValues,
  messages,
  modeLinked,
  onContinuousStart,
  onContinuousStop,
  onFieldChange,
  onHzChange,
  onImportableOnlyChange,
  onModeLinkChange,
  onClose,
  onPublish,
  onQosModeChange,
  onQosProfileChange,
  onResetHistory,
  onSelect,
  onTopicNameChange,
  onToggleExpanded,
  publishGraphTopics,
  publishName,
  publishResult,
  publishWarning,
  qosMode,
  qosProfile,
  publishHz,
  selected,
  selectedKey,
  showExpand,
  visibleMessages,
}) {
  return (
    <div className="interface-service-panel interface-execution-panel">
      <ExecutionPanelHeading expanded={expanded} onClose={onClose} onToggleExpanded={onToggleExpanded} showExpand={showExpand} title="등록 Topic 실행" />
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
          <QosModeControl
            groups={[{ key: 'topic', label: 'Topic QoS', profile: qosProfile, onChange: onQosProfileChange }]}
            mode={qosMode}
            modeLinked={modeLinked}
            onModeChange={onQosModeChange}
            onModeLinkChange={onModeLinkChange}
          />
          {selected?.message_schema?.map((field) => (
            <SchemaRequestField disabled={!selected?.import_available} field={field} key={field.name ?? field.raw_line} onChange={(value) => onFieldChange(field.name, value)} value={messageValues[field.name]} />
          ))}
          <label className="interface-service-field">
            <span>지속 발행 주기 (Hz)</span>
            <input disabled={Boolean(activeContinuousPublish)} max="50" min="0.1" onChange={(event) => onHzChange(Number(event.target.value))} step="0.1" type="number" value={publishHz} />
          </label>
          <div className="interface-receive-actions">
            <button className="interface-service-call-button" disabled={busy || !selected?.import_available} onClick={onPublish} type="button">{busy ? '처리 중…' : '1회 발행'}</button>
            <button className={activeContinuousPublish ? 'interface-receive-action-button warning' : 'interface-service-call-button'} disabled={busy || !selected?.import_available} onClick={activeContinuousPublish ? onContinuousStop : onContinuousStart} type="button">{activeContinuousPublish ? '지속 발행 중지' : '지속 발행'}</button>
          </div>
          {activeContinuousPublish && <div className="interface-service-state warning">Publishing continuously at {activeContinuousPublish.hz} Hz · {activeContinuousPublish.message_count ?? 0} message(s) sent</div>}
          <div className="interface-receive-actions"><button className="interface-receive-action-button warning" onClick={onResetHistory} type="button">Publish 이력 리셋</button></div>
          {publishResult && <CallResultBlock result={publishResult} successPayload={publishResult.message_json ?? publishResult.payload} />}
          <ReceiveHistory title="Topic publish history" items={history} />
        </>
      ) : <small>registry에 등록된 Message가 없습니다.</small>}
    </div>
  )
}
