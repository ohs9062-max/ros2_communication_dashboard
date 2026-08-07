import { schemaFields } from '../model/schemaValues.js'
import { firstType } from '../model/workspacePresentation.js'
import {
  CollapsibleJson,
  ConnectionList,
  HistoryList,
  LastResultBlock,
  RequestField,
  SectionTitle,
} from './WorkspaceShared.jsx'

export function TopicWorkspaceDetail({
  activeContinuousPublish,
  executing,
  inlineResult,
  item,
  messageValues,
  onHistorySelect,
  onMessageChange,
  onPublish,
  onContinuousStart,
  onContinuousStop,
  onReset,
  onSubscribeStart,
  onSubscribeStop,
  publishGraphTopics,
  selectedHistoryItem,
  selectPublishGraphTopic,
  setTopicPublishName,
  setTopicPublishHz,
  setTopicSubscribeName,
  topicPublishName,
  topicPublishHz,
  topicPublishWarning,
  topicSubscribeName,
}) {
  const activeSubscription = (item.topicStates ?? []).find(
    (state) => state.topic_name === topicSubscribeName && state.topic_type === item.fullType,
  )
  return (
    <>
      <SectionTitle title="연결된 Graph Topic" />
      <ConnectionList
        empty="Graph에서 이 Message full_type으로 열린 Topic이 없습니다."
        items={item.connectedTopics}
        render={(topic) => [
          topic.name,
          firstType(topic.type ?? topic.types) ?? '-',
          `publishers ${topic.publisher_count ?? 0}`,
          `subscribers ${topic.subscriber_count ?? 0}`,
        ].join(' · ')}
      />
      {(item.graphConflicts ?? []).length > 0 && (
        <CollapsibleJson
          title="같은 Topic 이름의 다른 type 경고"
          value={item.graphConflicts}
        />
      )}

      <SectionTitle title="Topic Publish" />
      <label className="interface-service-field">
        <span>기존 Graph Topic 후보</span>
        <select
          onChange={(event) => selectPublishGraphTopic(event.target.value)}
          value={publishGraphTopics.some((topic) => topic.name === topicPublishName) ? topicPublishName : ''}
        >
          <option value="">직접 입력</option>
          {publishGraphTopics.map((topic) => (
            <option key={topic.name} value={topic.name}>
              {topic.name} · {firstType(topic.type ?? topic.types) ?? '-'}
            </option>
          ))}
        </select>
        <small>
          선택하면 해당 Topic에 추가 Publisher로 발행합니다. 새 Topic을 만들려면 Publish Topic name을 직접 입력하세요.
        </small>
      </label>
      <label className="interface-service-field">
        <span>Publish Topic name</span>
        <input
          onChange={(event) => setTopicPublishName(event.target.value)}
          placeholder="/demo_topic"
          type="text"
          value={topicPublishName}
        />
      </label>
      {topicPublishWarning && (
        <div className="interface-service-state warning">{topicPublishWarning}</div>
      )}
      <p className="muted">
        full_type {item.fullType} · QoS {item.qos?.mode === 'adaptive' ? '상대 endpoint 자동 적용' : '실행 결과에서 확인'}
      </p>
      {schemaFields(item.schema).map((field) => (
        <RequestField
          field={field}
          key={field.name ?? field.raw_line}
          onChange={(value) => onMessageChange((current) => ({
            ...current,
            [field.name]: value,
          }))}
          value={messageValues[field.name]}
        />
      ))}
      <label className="interface-service-field">
        <span>지속 발행 주기 (Hz)</span>
        <input
          disabled={Boolean(activeContinuousPublish)}
          max="50"
          min="0.1"
          onChange={(event) => setTopicPublishHz(Number(event.target.value))}
          step="0.1"
          type="number"
          value={topicPublishHz}
        />
      </label>
      <div className="interface-inline-actions">
        <button
          className="interface-service-call-button"
          disabled={executing || !item.importAvailable}
          onClick={onPublish}
          type="button"
        >
          {executing ? '처리 중…' : '1회 발행'}
        </button>
        <button
          className={activeContinuousPublish ? 'interface-receive-action-button warning' : 'interface-service-call-button'}
          disabled={executing || !item.importAvailable}
          onClick={activeContinuousPublish ? onContinuousStop : onContinuousStart}
          type="button"
        >
          {activeContinuousPublish ? '지속 발행 중지' : '지속 발행'}
        </button>
      </div>
      {activeContinuousPublish && (
        <p className="interface-service-state warning">
          {activeContinuousPublish.hz} Hz로 지속 발행 중 · {activeContinuousPublish.message_count ?? 0}회 전송
        </p>
      )}

      <SectionTitle title="Topic Subscribe" />
      <label className="interface-service-field">
        <span>topic_name</span>
        <input
          onChange={(event) => setTopicSubscribeName(event.target.value)}
          placeholder="/demo_topic"
          type="text"
          value={topicSubscribeName}
        />
      </label>
      <p className="muted">
        Subscription key는 topic_name + full_type입니다. 같은 이름이라도 package/type이 다르면 별도 구독입니다.
      </p>
      <div className="interface-inline-actions">
        <button disabled={!item.importAvailable} onClick={onSubscribeStart} type="button">
          {activeSubscription ? '수신중 · 설정 갱신' : '수신 시작'}
        </button>
        <button disabled={!activeSubscription} onClick={onSubscribeStop} type="button">
          수신 중지
        </button>
        <button onClick={onReset} type="button">
          Publish/Subscribe 이력 초기화
        </button>
      </div>
      {activeSubscription && (
        <CollapsibleJson
          title={`수신 상태 · ${activeSubscription.message_count ?? 0}개`}
          value={activeSubscription}
        />
      )}

      <LastResultBlock fallback={item.lastRun} result={inlineResult} title="마지막 Topic 작업 결과" />
      <HistoryList
        empty="최근 Topic Publish/Subscribe 이력이 없습니다."
        items={item.history}
        onSelect={onHistorySelect}
        selected={selectedHistoryItem}
        type="topic"
      />
    </>
  )
}
