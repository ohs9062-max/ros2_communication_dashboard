/* oxlint-disable react/only-export-components */

import {
  defaultValue,
  firstType,
  historyKey,
  historyLabel,
  isArrayType,
  isComplexType,
  isNumericType,
  schemaFields,
  sourceLabel,
} from './interfaceLabModel.js'

export function SummaryCard({ label, tone = 'neutral', value }) {
  return (
    <div className={`interface-summary-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export function applyStatusLabel(status, rebuildRequired = false) {
  if (rebuildRequired) return '등록 변경됨 · 빌드 필요'
  const value = status?.status ?? status?.build_status ?? 'idle'
  const labels = {
    failed: '빌드 실패',
    idle: '대기 중',
    import_failed: '빌드 성공 · import 확인 실패',
    partial: '일부 적용 필요',
    rebuild_required: '재빌드 필요',
    running: '빌드 진행 중',
    success: '적용 완료',
  }
  return labels[value] ?? value
}

export function InterfaceCard({ item, onClick, selected }) {
  return (
    <button className={selected ? 'interface-card selected' : 'interface-card'} onClick={onClick} type="button">
      <span className="interface-card-line">
        <strong>{item.title}</strong>
        <span>/</span>
        <span>{item.subtitle}</span>
        {item.counts && (
          <span className="interface-count-badges">
            <CountBadge label="msg" tone="msg" value={item.counts.message} />
            <CountBadge label="srv" tone="srv" value={item.counts.service} />
            <CountBadge label="action" tone="action" value={item.counts.action} />
          </span>
        )}
      </span>
      <div className="interface-badge-row">
        <KindBadge kind={item.kind} />
        {(item.sources?.length ? item.sources : [item.source]).filter(Boolean).map((source) => (
          <Badge key={source} label={sourceLabel(source)} tone="blue" />
        ))}
        {item.graphOnly && <Badge label="미등록" tone="yellow" />}
        {item.packageName && <Badge label={item.packageName} tone="neutral" />}
        {item.importAvailable !== null && (
          <Badge label={item.importAvailable ? 'import됨' : 'import 안됨'} tone={item.importAvailable ? 'green' : 'yellow'} />
        )}
        {item.graphOnly && item.importAvailable === null && (
          <Badge label="import 확인 필요" tone="yellow" />
        )}
        {item.rebuildRequired && <Badge label="build 필요" tone="yellow" />}
        {item.serverAvailable !== null && (
          <Badge label={item.serverAvailable ? '서버 있음' : '서버 없음'} tone={item.serverAvailable ? 'green' : 'yellow'} />
        )}
        {item.callable !== null && (
          <Badge label={item.callable ? '실행 가능' : item.reason ?? '실행 불가'} tone={item.callable ? 'green' : 'yellow'} />
        )}
        {item.error && <Badge label="오류" tone="red" />}
      </div>
    </button>
  )
}

function KindBadge({ kind }) {
  const normalized = kind === 'callable_service' ? 'service'
    : kind === 'callable_action' ? 'action'
    : kind
  if (normalized === 'message') return <Badge label="msg" tone="msg" />
  if (normalized === 'service') return <Badge label="srv" tone="srv" />
  if (normalized === 'action') return <Badge label="action" tone="action" />
  if (normalized === 'package') return <Badge label="pkg" tone="package" />
  return null
}

function CountBadge({ label, tone, value }) {
  return <span className={`interface-count-badge ${tone}`}>{label} {value}</span>
}

export function InlineWorkspace({
  activeContinuousPublish,
  cancelingGoal,
  executing,
  goalTimeoutSec,
  goalValues,
  inlineResult,
  item,
  onActionExecute,
  onActionCancel,
  onGoalChange,
  onHistorySelect,
  onMessageChange,
  onRelatedSelect,
  onRequestChange,
  onServiceExecute,
  onTopicPublish,
  onTopicContinuousStart,
  onTopicContinuousStop,
  onTopicReset,
  onTopicSubscribeStart,
  onTopicSubscribeStop,
  relatedItems,
  messageValues,
  requestValues,
  selectedHistoryItem,
  selectPublishGraphTopic,
  setGoalTimeoutSec,
  setTopicPublishName,
  setTopicPublishHz,
  setTopicSubscribeName,
  setTimeoutSec,
  topicPublishName,
  topicPublishHz,
  publishGraphTopics,
  topicPublishWarning,
  topicSubscribeName,
  timeoutSec,
}) {
  const showDetail = item.kind !== 'package'
  return (
    <div className="interface-inline-workspace">
      {item.kind === 'package' && (
        <>
          <div className="interface-inline-heading">
            <strong>{item.title} 연결 항목</strong>
            <span>Service / Action을 누르면 여기서 바로 상세와 실행 폼을 봅니다.</span>
          </div>
          <div className="interface-related-grid">
            {relatedItems.length ? relatedItems.map((related) => (
              <button
                key={related.id}
                onClick={() => onRelatedSelect(related)}
                type="button"
              >
                <strong>{related.title}</strong>
                <span>{related.fullType}</span>
                <small>
                  {related.serverAvailable ? '서버 있음' : '서버 없음'}
                  {' · '}
                  {related.callable ? '실행 가능' : related.reason ?? '실행 대기'}
                </small>
              </button>
            )) : <p className="muted">연결된 Service/Action 항목이 없습니다.</p>}
          </div>
        </>
      )}
      {showDetail && (
        <InterfaceDetailPanel
          cancelingGoal={cancelingGoal}
          activeContinuousPublish={activeContinuousPublish}
          executing={executing}
          goalTimeoutSec={goalTimeoutSec}
          goalValues={goalValues}
          inlineResult={inlineResult}
          item={item}
          onActionExecute={onActionExecute}
          onActionCancel={onActionCancel}
          onGoalChange={onGoalChange}
          onHistorySelect={onHistorySelect}
          onMessageChange={onMessageChange}
          onRequestChange={onRequestChange}
          onServiceExecute={onServiceExecute}
          onTopicPublish={onTopicPublish}
          onTopicContinuousStart={onTopicContinuousStart}
          onTopicContinuousStop={onTopicContinuousStop}
          onTopicReset={onTopicReset}
          onTopicSubscribeStart={onTopicSubscribeStart}
          onTopicSubscribeStop={onTopicSubscribeStop}
          messageValues={messageValues}
          requestValues={requestValues}
          selectedHistoryItem={selectedHistoryItem}
          selectPublishGraphTopic={selectPublishGraphTopic}
          setGoalTimeoutSec={setGoalTimeoutSec}
          setTopicPublishName={setTopicPublishName}
          setTopicPublishHz={setTopicPublishHz}
          setTopicSubscribeName={setTopicSubscribeName}
          setTimeoutSec={setTimeoutSec}
          topicPublishName={topicPublishName}
          topicPublishHz={topicPublishHz}
          publishGraphTopics={publishGraphTopics}
          topicPublishWarning={topicPublishWarning}
          topicSubscribeName={topicSubscribeName}
          timeoutSec={timeoutSec}
        />
      )}
    </div>
  )
}

function InterfaceDetailPanel({
  activeContinuousPublish,
  cancelingGoal,
  executing,
  goalTimeoutSec,
  goalValues,
  inlineResult,
  item,
  onActionExecute,
  onActionCancel,
  onGoalChange,
  onHistorySelect,
  onMessageChange,
  onRequestChange,
  onServiceExecute,
  onTopicPublish,
  onTopicContinuousStart,
  onTopicContinuousStop,
  onTopicReset,
  onTopicSubscribeStart,
  onTopicSubscribeStop,
  messageValues,
  requestValues,
  selectedHistoryItem,
  selectPublishGraphTopic,
  setGoalTimeoutSec,
  setTopicPublishName,
  setTopicPublishHz,
  setTopicSubscribeName,
  setTimeoutSec,
  topicPublishName,
  topicPublishHz,
  publishGraphTopics,
  topicPublishWarning,
  topicSubscribeName,
  timeoutSec,
}) {
  if (!item) {
    return (
      <aside className="interface-detail-panel">
        <h3>상세</h3>
        <p className="muted">항목을 선택하세요.</p>
      </aside>
    )
  }
  return (
    <aside className="interface-detail-panel">
      <h3>{item.title}</h3>
      <dl>
        <dt>source</dt>
        <dd>{(item.sources?.length ? item.sources : [item.source]).filter(Boolean).map(sourceLabel).join(', ')}</dd>
        <dt>full type</dt>
        <dd>{item.fullType ?? '-'}</dd>
        <dt>package</dt>
        <dd>{item.packageName ?? '-'}</dd>
        <dt>import</dt>
        <dd>{item.importAvailable === null ? '-' : item.importAvailable ? 'import됨' : 'import 안됨'}</dd>
        <dt>build</dt>
        <dd>{item.rebuildRequired ? 'build 필요' : '빌드 반영/대기'}</dd>
        <dt>server</dt>
        <dd>{item.serverAvailable === null ? '-' : item.serverAvailable ? '서버 있음' : '서버 없음'}</dd>
        <dt>callable</dt>
        <dd>{item.callable === null ? '-' : item.callable ? '실행 가능' : item.reason ?? '실행 불가'}</dd>
        {item.error && (
          <>
            <dt>error</dt>
            <dd>{item.error}</dd>
          </>
        )}
      </dl>
      <CollapsibleJson title="상태 상세" value={item.status ?? {}} />
      <CollapsibleJson title="parsed / schema" value={item.parsed ?? item.schema ?? {}} />
      <CollapsibleText title="raw_text" value={item.raw_text ?? ''} />
      {item.kind === 'message' && (
        <TopicWorkspaceDetail
          activeContinuousPublish={activeContinuousPublish}
          executing={executing}
          inlineResult={inlineResult}
          item={item}
          messageValues={messageValues}
          onHistorySelect={onHistorySelect}
          onMessageChange={onMessageChange}
          onPublish={onTopicPublish}
          onContinuousStart={onTopicContinuousStart}
          onContinuousStop={onTopicContinuousStop}
          onReset={onTopicReset}
          onSubscribeStart={onTopicSubscribeStart}
          onSubscribeStop={onTopicSubscribeStop}
          selectedHistoryItem={selectedHistoryItem}
          selectPublishGraphTopic={selectPublishGraphTopic}
          setTopicPublishName={setTopicPublishName}
          setTopicPublishHz={setTopicPublishHz}
          setTopicSubscribeName={setTopicSubscribeName}
          topicPublishName={topicPublishName}
          topicPublishHz={topicPublishHz}
          publishGraphTopics={publishGraphTopics}
          topicPublishWarning={topicPublishWarning}
          topicSubscribeName={topicSubscribeName}
        />
      )}
      {(item.kind === 'service' || item.kind === 'callable_service') && (
        <ServiceWorkspaceDetail
          executing={executing}
          inlineResult={inlineResult}
          item={item}
          onExecute={onServiceExecute}
          onHistorySelect={onHistorySelect}
          onRequestChange={onRequestChange}
          requestValues={requestValues}
          selectedHistoryItem={selectedHistoryItem}
          setTimeoutSec={setTimeoutSec}
          timeoutSec={timeoutSec}
        />
      )}
      {(item.kind === 'action' || item.kind === 'callable_action') && (
        <ActionWorkspaceDetail
          cancelingGoal={cancelingGoal}
          executing={executing}
          goalTimeoutSec={goalTimeoutSec}
          goalValues={goalValues}
          inlineResult={inlineResult}
          item={item}
          onExecute={onActionExecute}
          onCancel={onActionCancel}
          onGoalChange={onGoalChange}
          onHistorySelect={onHistorySelect}
          selectedHistoryItem={selectedHistoryItem}
          setGoalTimeoutSec={setGoalTimeoutSec}
        />
      )}
    </aside>
  )
}

function ServiceWorkspaceDetail({
  executing,
  inlineResult,
  item,
  onExecute,
  onHistorySelect,
  onRequestChange,
  requestValues,
  selectedHistoryItem,
  setTimeoutSec,
  timeoutSec,
}) {
  const callableTarget = item.connectedServices?.find((service) => service.callable)
    ?? (item.kind === 'callable_service' ? item.status : null)
  return (
    <>
      <SectionTitle title="연결된 Graph Service" />
      <ConnectionList
        empty="이 타입으로 열린 Service가 없습니다."
        items={item.connectedServices}
        render={(service) => `${service.service_name || '서버 없음'} · servers ${service.server_count ?? 0} · ${service.callable ? '실행 가능' : service.reason ?? '실행 불가'}`}
      />
      <SectionTitle title="실행 폼" />
      {callableTarget ? (
        <>
          {schemaFields(item.schema).map((field) => (
            <RequestField
              field={field}
              key={field.name ?? field.raw_line}
              onChange={(value) => onRequestChange((current) => ({
                ...current,
                [field.name]: value,
              }))}
              value={requestValues[field.name]}
            />
          ))}
          <label className="interface-service-field">
            <span>timeout_sec</span>
            <input
              min="0.1"
              onChange={(event) => setTimeoutSec(Number(event.target.value))}
              step="0.1"
              type="number"
              value={timeoutSec}
            />
          </label>
          <button
            className="interface-service-call-button"
            disabled={executing || !callableTarget.callable}
            onClick={onExecute}
            type="button"
          >
            {executing ? '실행 중…' : `${callableTarget.service_name} 실행`}
          </button>
        </>
      ) : (
        <p className="muted">import됐고 서버가 있는 Service가 있을 때 실행 폼이 활성화됩니다.</p>
      )}
      <LastResultBlock fallback={item.lastRun} result={inlineResult} title="마지막 호출 결과" />
      <HistoryList
        empty="최근 호출 이력이 없습니다."
        items={item.history}
        onSelect={onHistorySelect}
        selected={selectedHistoryItem}
        type="service"
      />
    </>
  )
}

function TopicWorkspaceDetail({
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

function ActionWorkspaceDetail({
  cancelingGoal,
  executing,
  goalTimeoutSec,
  goalValues,
  inlineResult,
  item,
  onExecute,
  onCancel,
  onGoalChange,
  onHistorySelect,
  selectedHistoryItem,
  setGoalTimeoutSec,
}) {
  const callableTarget = item.connectedActions?.find((action) => action.callable)
    ?? (item.kind === 'callable_action' ? item.status : null)
  return (
    <>
      <SectionTitle title="연결된 Graph Action" />
      <ConnectionList
        empty="이 타입으로 열린 Action이 없습니다."
        items={item.connectedActions}
        render={(action) => [
          `action name ${action.action_name || '서버 없음'}`,
          `graph type ${action.graph_type ?? action.action_type ?? '-'}`,
          `selected/import type ${action.selected_import_type ?? action.full_type ?? item.fullType ?? '-'}`,
          `exact-type servers ${action.server_count ?? 0}`,
          (action.executable ?? action.callable)
            ? 'exact-type 실행 가능'
            : action.reason ?? 'exact-type 실행 불가',
        ].join(' · ')}
      />
      <SectionTitle title="Goal 입력 폼" />
      {callableTarget ? (
        <>
          {schemaFields(item.schema).map((field) => (
            <RequestField
              field={field}
              key={field.name ?? field.raw_line}
              onChange={(value) => onGoalChange((current) => ({
                ...current,
                [field.name]: value,
              }))}
              value={goalValues[field.name]}
            />
          ))}
          <label className="interface-service-field">
            <span>timeout_sec</span>
            <input
              min="0.1"
              onChange={(event) => setGoalTimeoutSec(Number(event.target.value))}
              step="0.1"
              type="number"
              value={goalTimeoutSec}
            />
          </label>
          <button
            className="interface-service-call-button"
            disabled={executing || !callableTarget.callable}
            onClick={onExecute}
            type="button"
          >
            {executing ? '요청 전송 중…' : `${callableTarget.action_name} Goal 실행`}
          </button>
          <button
            className="interface-service-call-button"
            disabled={!executing || cancelingGoal}
            onClick={onCancel}
            type="button"
          >
            {cancelingGoal ? '취소 요청 중…' : '활성 Goal 취소'}
          </button>
        </>
      ) : (
        <p className="muted">import됐고 서버가 있는 Action이 있을 때 Goal 폼이 활성화됩니다.</p>
      )}
      <LastResultBlock fallback={item.lastRun} result={inlineResult} title="마지막 실행 결과" />
      <SectionTitle title="Action 관련 Topic" />
      <ConnectionList
        empty="관련 action topic이 아직 snapshot에 없습니다."
        items={item.connectedTopics}
        render={(topic) => `${topic.name} · ${topic.type ?? topic.types?.[0] ?? '-'} · ${topic.last_received_at ? `last ${formatTime(topic.last_received_at)}` : '아직 수신 없음'} · count ${topic.message_count ?? topic.received_count ?? 0}`}
      />
      <HistoryList
        empty="최근 Goal 이력이 없습니다."
        items={item.history}
        onSelect={onHistorySelect}
        selected={selectedHistoryItem}
        type="action"
      />
    </>
  )
}

function SectionTitle({ title }) {
  return <h4 className="interface-detail-section-title">{title}</h4>
}

function ConnectionList({ empty, items = [], render }) {
  if (!items.length) return <p className="muted">{empty}</p>
  return (
    <ul className="interface-connection-list">
      {items.map((item, index) => (
        <li key={`${index}-${render(item)}`}>{render(item)}</li>
      ))}
    </ul>
  )
}

function LastResultBlock({ fallback, result, title }) {
  const value = result ?? fallback
  if (!value) return <CollapsibleJson title={title} value={{ status: '아직 결과 없음' }} />
  return <CollapsibleJson title={title} value={value} />
}

function HistoryList({ empty, items = [], onSelect, selected, type }) {
  if (!items.length) return <p className="muted">{empty}</p>
  return (
    <div className="interface-history-list">
      <SectionTitle title={type === 'service' ? '최근 호출 이력' : '최근 실행 이력'} />
      {items.slice(0, 20).map((item) => (
        <button
          className={selected === item ? 'selected' : ''}
          key={historyKey(item, type)}
          onClick={() => onSelect(selected === item ? null : item)}
          type="button"
        >
          {historyLabel(item, type)}
        </button>
      ))}
      {selected && <CollapsibleJson title="선택한 이력 전체 JSON" value={selected} />}
    </div>
  )
}

function Badge({ label, tone = 'neutral' }) {
  return <span className={`interface-badge ${tone}`}>{label}</span>
}

function CollapsibleJson({ title, value }) {
  return (
    <details className="interface-detail-block">
      <summary>{title}</summary>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </details>
  )
}

function CollapsibleText({ title, value }) {
  return (
    <details className="interface-detail-block">
      <summary>{title}</summary>
      <pre>{value}</pre>
    </details>
  )
}

function RequestField({ field, onChange, value }) {
  if (!field?.name) return null
  const type = field.type ?? ''
  if (type === 'bool' || type === 'boolean') {
    return (
      <label className="interface-service-field inline">
        <input
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
          type="checkbox"
        />
        <span>{field.name}</span>
      </label>
    )
  }
  if (isComplexType(type)) {
    return (
      <label className="interface-service-field">
        <span>{field.name} <small>{type} · JSON</small></span>
        <textarea
          onChange={(event) => {
            try {
              onChange(JSON.parse(event.target.value || 'null'))
            } catch {
              onChange(event.target.value)
            }
          }}
          rows={isArrayType(type) ? 4 : 3}
          value={typeof value === 'string' ? value : JSON.stringify(value ?? defaultValue(type), null, 2)}
        />
      </label>
    )
  }
  const numeric = isNumericType(type)
  return (
    <label className="interface-service-field">
      <span>{field.name} <small>{type}</small></span>
      <input
        onChange={(event) => onChange(event.target.value)}
        type={numeric ? 'number' : 'text'}
        value={value ?? ''}
      />
    </label>
  )
}
