import { CollapsibleJson, SectionTitle } from './WorkspaceShared.jsx'
import { QosModeControl } from '../execution/QosModeControl.jsx'

export function TopicSubscribePanel({
  item,
  onSubscribeQosModeChange,
  onSubscribeQosProfileChange,
  onSubscribeStart,
  onSubscribeStop,
  setTopicSubscribeName,
  subscribeQosMode,
  subscribeQosProfile,
  topicSubscribeName,
}) {
  const activeSubscription = (item.topicStates ?? []).find(
    (state) => state.topic_name === topicSubscribeName && state.topic_type === item.fullType,
  )
  return (
    <>
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
      <QosModeControl
        groups={[{ key: 'topic', label: 'Topic Subscribe QoS', profile: subscribeQosProfile, onChange: onSubscribeQosProfileChange }]}
        mode={subscribeQosMode}
        onModeChange={onSubscribeQosModeChange}
      />
      <details className="interface-advanced-section"><summary>고급 설정</summary><p className="muted">
        Subscription key는 topic_name + full_type입니다. 같은 이름이라도 package/type이 다르면 별도 구독입니다.
      </p></details>
      <div className="interface-inline-actions">
        <button disabled={!item.importAvailable} onClick={activeSubscription ? onSubscribeStop : onSubscribeStart} type="button">
          {activeSubscription ? '수신 중지' : '수신 시작'}
        </button>
      </div>
      {activeSubscription && (
        <CollapsibleJson title={`수신 상태 · ${activeSubscription.message_count ?? 0}개`} value={activeSubscription} />
      )}
    </>
  )
}
