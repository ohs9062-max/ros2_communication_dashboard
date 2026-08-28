import { ReceiveHistory } from '../InterfaceExecutionShared.jsx'
import {
  messageKey,
  topicGraphStatusLabel,
  topicStatusLabel,
} from '../model/interfaceUploadModel.js'
import { QosModeControl } from '../execution/QosModeControl.jsx'

export function TopicReceivePanel({
  allMessages,
  allTopics,
  domainIds = [],
  filteredTopics,
  importableOnly,
  modeLinked,
  onDomainChange = () => {},
  onImportableOnlyChange,
  onMessageSelect,
  onModeLinkChange,
  onRefresh,
  onQosModeChange,
  onQosProfileChange,
  onResetAll,
  onResetSelected,
  onSearchChange,
  onStart,
  onStop,
  onTopicNameChange,
  receiveHistory,
  receiving,
  receivingTopics,
  qosMode,
  qosProfile,
  search,
  selectedMessage,
  selectedMessageKey,
  selectedDomainId,
  selectedTopic,
  visibleMessages,
}) {
  return (
    <div className="interface-receive-grid">
      <label className="interface-service-field">
        <span>Domain</span>
        <select onChange={(event) => onDomainChange(event.target.value === '' ? null : Number(event.target.value))} value={selectedDomainId ?? ''}>
          <option value="">Domain 선택</option>
          {domainIds.map((domainId) => <option key={domainId} value={domainId}>D{domainId}</option>)}
        </select>
      </label>
      <label className="interface-service-field">
        <span>항목 검색</span>
        <input placeholder="Topic 이름 또는 type 검색" value={search} onChange={(event) => onSearchChange(event.target.value)} />
      </label>
      <label className="interface-filter-check">
        <input checked={importableOnly} onChange={(event) => onImportableOnlyChange(event.target.checked)} type="checkbox" />
        <span>import된 메시지만 보기</span>
        <small>{visibleMessages.length}/{allMessages.length}</small>
      </label>
      <label className="interface-service-field">
        <span>메시지 타입 · D{selectedDomainId ?? '-'} · {visibleMessages.length}/{allMessages.length}개</span>
        <select value={selectedMessageKey} onChange={(event) => onMessageSelect(event.target.value)}>
          {visibleMessages.map((message) => (
            <option key={messageKey(message)} value={messageKey(message)}>
              {message.import_available ? 'import됨' : 'import 안됨'} · {topicStatusLabel(message)} · {topicGraphStatusLabel(message)} · {message.message_type ?? message.full_type}
            </option>
          ))}
        </select>
        {!visibleMessages.length && <small>등록된 Message가 없습니다. 타입 기입에서 std_msgs/msg/String 같은 안전한 Message를 먼저 등록하세요.</small>}
      </label>
      <label className="interface-service-field">
        <span>Graph Topic 후보 · {filteredTopics.length}/{allTopics.length}</span>
        <select value={filteredTopics.find((topic) => topic.name === selectedTopic && topic.domain_id === selectedDomainId)?.resource_key ?? ''} onChange={(event) => onTopicNameChange(event.target.value, 'graph')}>
          {filteredTopics.map((topic) => (
            <option key={topic.resource_key} value={topic.resource_key}>Domain {topic.domain_id} · {topic.name} · {topic.type ?? topic.types?.[0] ?? '-'}</option>
          ))}
        </select>
        {!filteredTopics.length && <small>검색 결과가 없습니다.</small>}
      </label>
      <label className="interface-service-field">
        <span>Subscribe Topic name</span>
        <input placeholder="/interface_lab_topic_test" value={selectedTopic} onChange={(event) => onTopicNameChange(event.target.value, 'user')} />
        {selectedDomainId !== null && <small>실행 Domain {selectedDomainId}</small>}
      </label>
      <label className="interface-service-field">
        <span>선택 Message</span>
        <input readOnly value={selectedMessage?.message_type ?? ''} />
      </label>
      {selectedMessage && (
        <div className={`interface-service-state ${selectedMessage.import_available ? 'success' : 'warning'}`}>
          {selectedMessage.import_available ? '수신 가능 · import됨' : '수신 불가 · import 안됨'}
          {selectedMessage.import_error ? ` · ${selectedMessage.import_error}` : ''}
        </div>
      )}
      <QosModeControl
        groups={[{ key: 'topic', label: 'Topic QoS', profile: qosProfile, onChange: onQosProfileChange }]}
        mode={qosMode}
        modeLinked={modeLinked}
        onModeChange={onQosModeChange}
        onModeLinkChange={onModeLinkChange}
      />
      <p className="interface-package-help">
        Topic 수신은 선택한 메시지 타입과 Subscribe Topic name 조합으로 시작합니다.
        Publish payload 입력과 Publish 버튼은 왼쪽 Topic 실행 창에서 처리합니다.
      </p>
      <div className="interface-receive-actions">
        <button className={receiving ? 'interface-receive-action-button receiving' : 'interface-receive-action-button primary'} disabled={receiving || !selectedMessage?.import_available} onClick={onStart} type="button">
          {receiving ? '수신 중' : '수신 시작'}
        </button>
        <button className="interface-receive-action-button" onClick={onStop} type="button">수신 중지</button>
        <button className="interface-receive-action-button warning" onClick={onResetSelected} type="button">선택 이력 리셋</button>
        <button className="interface-receive-action-button warning" onClick={onResetAll} type="button">전체 이력 리셋</button>
        <button className="interface-receive-action-button ghost" onClick={onRefresh} type="button">새로고침</button>
      </div>
      <ReceiveHistory title="수신 중 Topic" items={receivingTopics} />
      <ReceiveHistory title="Topic subscribe latest/history" items={receiveHistory} />
    </div>
  )
}
