import { qosReasonText } from '../../utils/qosDisplayText.js'

export function ActionGoalResult({ result }) {
  return (
    <div className="interface-action-result">
      <span className={result.accepted ? 'success' : 'error'}>
        {result.accepted ? 'accepted' : 'rejected/failed'}
      </span>
      {Array.isArray(result.feedback) && result.feedback.length > 0 && (
        <div className="interface-action-feedback">
          <span>feedback</span>
          <ul>{result.feedback.map((item, index) => (
            <li key={`${index}-${JSON.stringify(item)}`}><code>{JSON.stringify(item)}</code></li>
          ))}</ul>
        </div>
      )}
      <CallResultBlock result={result} successPayload={result.result} />
    </div>
  )
}

export function CallResultBlock({ result, successPayload }) {
  const validationError = result.error_type === 'validation_error'
  return (
    <>
      {validationError && (
        <div className="interface-validation-warning">The payload does not match the selected ROS2 type. Nothing was sent.</div>
      )}
      {result.qos && <ExecutionQosSummary qos={result.qos} />}
      <pre className={`interface-service-result ${result.success ? 'success' : 'error'}`}>
        {JSON.stringify(result.success ? successPayload : result, null, 2)}
      </pre>
    </>
  )
}

function QosChannel({ label, state }) {
  if (!state) return null
  const remote = state.remote_qos ?? {
    qos_detection_source: state.qos_detection_source,
    publisher_qos: state.publisher_qos,
    subscriber_qos: state.subscriber_qos,
  }
  const dashboard = state.dashboard_qos ?? state.local_qos
  return (
    <div className="interface-qos-result-channel">
      <strong>{label}</strong>
      <span>QoS Mode: {state.qos_mode === 'manual' ? 'Manual' : 'Auto'}</span>
      {state.fallback_reason && <div className="interface-service-state warning">{qosReasonText(state.fallback_reason, state)}</div>}
      <details><summary>Remote QoS</summary><pre>{JSON.stringify(remote, null, 2)}</pre></details>
      <details><summary>Dashboard 실행 QoS</summary><pre>{JSON.stringify(dashboard, null, 2)}</pre></details>
    </div>
  )
}

export function ExecutionQosSummary({ qos }) {
  const channels = ['request', 'response', 'goal', 'result', 'cancel', 'feedback', 'status']
    .filter((key) => qos?.[key])
  return (
    <div className="interface-qos-result">
      <h4>실제 사용 QoS</h4>
      {channels.length
        ? channels.map((key) => <QosChannel key={key} label={key[0].toUpperCase() + key.slice(1)} state={qos[key]} />)
        : <QosChannel label="실행 채널" state={qos} />}
    </div>
  )
}

export function ServiceCallHistory({ calls }) {
  if (!calls.length) return null
  return (
    <div className="interface-service-history">
      <span>최근 실행</span>
      <ul>{calls.slice(0, 3).map((call) => (
        <li key={`${call.called_at}-${call.service_name}`}>
          {call.service_name} · {call.success ? '성공' : '실패'} · {Math.round(call.elapsed_ms ?? 0)}ms
        </li>
      ))}</ul>
    </div>
  )
}

export function ActionGoalHistory({ goals }) {
  if (!goals.length) return null
  return (
    <div className="interface-service-history">
      <span>최근 Goal</span>
      <ul>{goals.slice(0, 3).map((goal) => (
        <li key={`${goal.sent_at}-${goal.action_name}`}>
          {goal.action_name} · {goal.accepted ? 'accepted' : 'rejected'} · {Math.round(goal.elapsed_ms ?? 0)}ms
        </li>
      ))}</ul>
    </div>
  )
}

export function ReceiveHistory({
  busy = false,
  fullItem = false,
  items = [],
  onRefresh,
  onReset,
  resetDisabled = false,
  title,
}) {
  return (
    <div className="interface-receive-history">
      <div className="interface-receive-history-heading">
        <strong>{title} · {items.length}개</strong>
        {(onRefresh || onReset) && <div className="interface-receive-actions">
          {onRefresh && <button className="interface-receive-action-button ghost" disabled={busy} onClick={onRefresh} type="button">{busy ? '조회 중…' : '새로고침'}</button>}
          {onReset && <button
            className="interface-receive-action-button warning"
            disabled={busy || resetDisabled}
            onClick={() => window.confirm('현재 선택한 Server의 이력을 초기화할까요?') && onReset()}
            type="button"
          >이력 리셋</button>}
        </div>}
      </div>
      {items.length ? (
        <ul>{items.map((item, index) => (
          <li key={`${title}-${index}-${item.id ?? item.topic_name ?? item.service_name ?? item.action_name}`}>
            <span>
              {item.topic_name ?? item.service_name ?? item.action_name ?? item.direction ?? 'event'}
              {' · '}
              {item.status ?? (item.receiving ? 'receiving' : item.success === false ? 'failed' : 'ok')}
            </span>
            <pre>{JSON.stringify(
              fullItem
                ? item
                : item.last_message ?? item.message_json ?? item.response ?? item.result ?? item.feedback ?? item,
              null,
              2,
            )}</pre>
          </li>
        ))}</ul>
      ) : <small>수신 이력이 없습니다.</small>}
    </div>
  )
}
