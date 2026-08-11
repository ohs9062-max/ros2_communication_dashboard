import { schemaFields } from '../model/schemaValues.js'
import { firstType } from '../model/workspacePresentation.js'
import { RequestField, SectionTitle } from './WorkspaceShared.jsx'
import { QosModeControl } from '../execution/QosModeControl.jsx'

export function TopicPublishPanel({
  activeContinuousPublish,
  executing,
  item,
  messageValues,
  onContinuousStart,
  onContinuousStop,
  onMessageChange,
  onPublish,
  onPublishQosModeChange,
  onPublishQosProfileChange,
  publishGraphTopics,
  selectPublishGraphTopic,
  setTopicPublishHz,
  setTopicPublishName,
  topicPublishHz,
  topicPublishName,
  topicPublishWarning,
  publishQosMode,
  publishQosProfile,
}) {
  return (
    <>
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
      {topicPublishWarning && <div className="interface-service-state warning">{topicPublishWarning}</div>}
      <QosModeControl
        groups={[{ key: 'topic', label: 'Topic Publish QoS', profile: publishQosProfile, onChange: onPublishQosProfileChange }]}
        mode={publishQosMode}
        onModeChange={onPublishQosModeChange}
      />
      <p className="muted">
        full_type {item.fullType} · QoS {item.qos?.mode === 'adaptive' ? '상대 endpoint 자동 적용' : '실행 결과에서 확인'}
      </p>
      {schemaFields(item.schema).map((field) => (
        <RequestField
          field={field}
          key={field.name ?? field.raw_line}
          onChange={(value) => onMessageChange((current) => ({ ...current, [field.name]: value }))}
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
        <button className="interface-service-call-button" disabled={executing || !item.importAvailable} onClick={onPublish} type="button">
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
    </>
  )
}
