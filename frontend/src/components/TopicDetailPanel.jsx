import {
  formatAge,
  formatNumber,
  formatRelativeTime,
} from '../utils/format.js'
import { withExecutionNode } from '../utils/participants.js'
import { displayText } from '../utils/displayText.js'
import { ConnectionNodeList } from './ConnectionNodeList.jsx'
import { CommunicationHistory } from './CommunicationHistory.jsx'
import { DetailSection } from './DetailSection.jsx'
import { KeyValueTable } from './KeyValueTable.jsx'
import { QosDetails } from './QosDetails.jsx'
import { QosSummaryNotice } from './QosSummary.jsx'
import { StatusBadge } from './StatusBadge.jsx'
import { topicEffectiveStatus } from '../utils/status.js'
import { CameraTopicPreview } from '../features/topics/CameraTopicPreview.jsx'
import { isCameraTopicType } from '../features/topics/cameraPreviewModel.js'

export function TopicDetailPanel({ cameraPreview, topic, latest, hz, onClose, participants, qosFocusRequest }) {
  if (!topic) {
    return (
      <aside className="detail-panel">
        <div className="empty-state">
          발견된 Topic이 있으면 상세 정보가 자동으로 표시됩니다
        </div>
      </aside>
    )
  }

  const latestData = latest.data?.data
  const hzData = hz.data?.data
  const preview = latestData?.message_preview ?? topic.last_message_preview
  const values = preview?.values
  const cameraType = isCameraTopicType(topic.types?.[0])
  const cameraData =
    cameraPreview?.data?.data?.name === topic.name
      ? cameraPreview.data.data
      : null
  const effectiveStatus = topicEffectiveStatus(topic)
  const neverReceived = effectiveStatus === 'never_received'

  return (
    <aside className="detail-panel">
      <div className="panel-heading">
        <span>Topic 상세</span>
        <div className="detail-panel-heading-actions">
          <StatusBadge value={effectiveStatus} />
          <button className="detail-panel-close" onClick={onClose} type="button">닫기 ×</button>
        </div>
      </div>
      <h2>{topic.name}</h2>
      <p className="muted">{topic.types?.[0] ?? '-'}</p>

      <QosSummaryNotice
        kind="topic"
        qos={topic}
      />

      {latest.error && <p className="error-text">{latest.error}</p>}
      {hz.error && <p className="error-text">{hz.error}</p>}
      {cameraType && cameraPreview?.error && (
        <p className="error-text">{cameraPreview.error}</p>
      )}
      {neverReceived && (
        <ReceptionDiagnosis diagnosis={topic.reception_diagnosis} />
      )}
      {!neverReceived && effectiveStatus === 'stale' && (
        <ReceptionDiagnosis diagnosis={topic.reception_diagnosis} />
      )}

      <DetailSection title="상태 요약">
        <DetailLine label="이름" value={topic.name} />
        <DetailLine label="타입" value={topic.types?.[0] ?? '-'} />
        <DetailLine label="상태" tone={statusTone(effectiveStatus)} value={displayText(effectiveStatus)} />
        <DetailLine label="상태 이유" value={displayText(topic.reason)} />
        <DetailLine
          label="마지막 확인"
          value={formatRelativeTime(topic.last_updated)}
        />
      </DetailSection>

      {cameraType && (
        <CameraTopicPreview
          data={cameraData}
          hz={hzData?.hz}
          metadata={cameraData?.metadata ?? preview}
          topicName={topic.name}
          topicType={topic.types?.[0]}
        />
      )}

      <CommunicationHistory
        kind="topic"
        name={topic.name}
        resourceType={topic.types?.[0]}
      />

      <QosDetails
        focusRequest={qosFocusRequest?.name === topic.name ? qosFocusRequest : null}
        qos={topic}
        title="Topic QoS"
      />

      <DetailSection collapsible title="연결 정보">
        <div className="detail-line">
          <span>Publisher Node 수 (Dashboard 제외)</span>
          <strong>{topic.publisher_node_count ?? topic.publisher_count ?? 0}</strong>
        </div>
        <div className="detail-line">
          <span>Subscriber Node 수 (Dashboard 제외)</span>
          <strong>{topic.subscriber_node_count ?? topic.subscriber_count ?? 0}</strong>
        </div>
        <div className="detail-line">
          <span>전체 Publisher Endpoint 수</span>
          <strong>{topic.publisher_endpoint_count ?? topic.publisher_count ?? 0}</strong>
        </div>
        <div className="detail-line">
          <span>전체 Subscriber Endpoint 수</span>
          <strong>{topic.subscriber_endpoint_count ?? topic.subscriber_count ?? 0}</strong>
        </div>
        <div className="detail-line">
          <span>상세 감시</span>
          <strong className={topic.deep_monitoring ? 'detail-value-good' : 'detail-value-muted'}>
            {topic.deep_monitoring ? '예' : '아니오'}
          </strong>
        </div>
        {(topic.internal_subscriber_node_count ?? 0) > 0 && (
          <p className="detail-help-text">
            Dashboard 자체 구독만 있는 경우 Subscriber Node 수는 0으로
            표시됩니다. Endpoint 수는 Dashboard 통신을 포함한 Graph 원본
            진단값입니다.
          </p>
        )}
      </DetailSection>

      <DetailSection collapsible title="연결 Node">
        <p className="detail-help-text">
          외부 Node는 ROS2 Graph 기준이며, Interface Lab 발행 주체는 외부 Node
          수에서 제외하고 내부 실행 주체로 구분해 표시합니다.
        </p>
        <ConnectionNodeList
          emptyText="발행자 Node 없음"
          items={withExecutionNode(
            participants?.publishers ?? [],
            topic.dashboard_communication?.execution_node,
          )}
          title="발행자 Node"
        />
        <ConnectionNodeList
          emptyText="구독자 Node 없음"
          items={participants?.subscribers ?? []}
          title="구독자 Node"
        />
      </DetailSection>

      <DetailSection collapsible title="실행/측정 정보">
        <div className="metric-grid">
          <Metric label="Hz" value={formatNumber(hzData?.hz)} />
          <Metric
            label="수신 여부"
            tone={hzData?.received ? 'good' : 'muted'}
            value={hzData?.received ? '예' : '아니오'}
          />
          <Metric label="메시지 수" value={hzData?.message_count ?? '-'} />
          <Metric label="경과 시간" value={formatAge(hzData?.age_sec)} />
          <Metric
            label="오래됨"
            tone={hzData?.is_stale ? 'warn' : 'good'}
            value={hzData?.is_stale ? '예' : '아니오'}
          />
          <Metric
            label="상태"
            tone={statusTone(hzData?.status)}
            value={hzData?.status ?? '-'}
          />
        </div>
      </DetailSection>

      <DetailSection collapsible title="상세 데이터">
        <div className="detail-line">
          <span>수신 여부</span>
          <strong className={latestData?.received ? 'detail-value-good' : 'detail-value-muted'}>
            {latestData?.received ? '예' : '아니오'}
          </strong>
        </div>
        <div className="detail-line">
          <span>마지막 수신</span>
          <strong>
            {formatRelativeTime(
              latestData?.last_received_at ?? topic.last_received_at,
            )}
          </strong>
        </div>
        <div className="detail-line">
          <span>상세 감시</span>
          <strong className={topic.detailed_monitoring_enabled ? 'detail-value-good' : 'detail-value-muted'}>
            {topic.detailed_monitoring_enabled ? '예' : '아니오'}
          </strong>
        </div>
        <div className="detail-line">
          <span>관찰됨</span>
          <strong className={topic.observed ? 'detail-value-good' : 'detail-value-muted'}>
            {topic.observed ? '예' : '아니오'}
          </strong>
        </div>
      </DetailSection>

      {!cameraType && (
        <>
          <DetailSection collapsible title="장치 상태 값">
            <KeyValueTable values={values} />
          </DetailSection>

          <DetailSection collapsible title="원본 Preview JSON">
            <pre className="preview-json">
              {preview ? JSON.stringify(preview, null, 2) : 'preview 없음'}
            </pre>
          </DetailSection>
        </>
      )}
    </aside>
  )
}

function ReceptionDiagnosis({ diagnosis }) {
  if (!diagnosis) return null
  const confirmed = diagnosis.certainty === 'confirmed'
  const localReliability = diagnosis.local_qos?.reliability
  const remoteReliability = remoteReliabilities(diagnosis.remote_qos)
  return (
    <section className={`topic-reception-diagnosis ${confirmed ? 'confirmed' : 'candidate'}`}>
      <div className="topic-reception-diagnosis-heading">
        <strong>{diagnosis.reception_status === 'stale' ? '수신 중단' : '미수신'}</strong>
        <span>{confirmed ? '원인 확인' : diagnosis.certainty === 'unknown' ? '원인 확인 불가' : '원인 후보'}</span>
      </div>
      <p>{diagnosis.message}</p>
      <div className="topic-reception-diagnosis-grid">
        <DetailLine label="Publisher" value={diagnosis.publisher_present ? '존재' : '없음'} />
        <DetailLine label="Dashboard Subscription" value={diagnosis.subscription_created ? '존재' : '없음'} />
        <DetailLine label="QoS 상태" value={diagnosis.qos_status ?? 'unknown'} />
        <DetailLine label="판정 근거" value={diagnosis.qos_detection_source ?? '-'} />
        {(localReliability || remoteReliability) && (
          <DetailLine
            label="Reliability"
            value={`${remoteReliability || '-'} ↔ ${localReliability || '-'}`}
          />
        )}
        {diagnosis.mismatch_policies?.length > 0 && (
          <DetailLine label="불일치 정책" value={diagnosis.mismatch_policies.join(', ')} />
        )}
      </div>
    </section>
  )
}

function remoteReliabilities(remote) {
  const entries = Array.isArray(remote) ? remote : []
  return [...new Set(entries.map((item) => item?.qos?.reliability ?? item?.reliability).filter(Boolean))].join(', ')
}

function DetailLine({ label, tone, value }) {
  return (
    <div className="detail-line">
      <span>{label}</span>
      <strong className={detailValueClass(tone)}>{value}</strong>
    </div>
  )
}

function Metric({ label, tone, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong className={detailValueClass(tone)}>{value}</strong>
    </div>
  )
}

function detailValueClass(tone) {
  return tone ? `detail-value-${tone}` : undefined
}

function statusTone(status) {
  const value = String(status || '').toLowerCase()
  if (['active', 'success', 'succeeded', 'normal_hz'].includes(value)) {
    return 'good'
  }
  if (
    [
      'warning',
      'stale',
      'waiting_publisher',
      'waiting_server',
      'pending',
      'canceling',
      'canceled',
      'low_hz',
    ].includes(value)
  ) {
    return 'warn'
  }
  if (
    [
      'error',
      'critical',
      'disconnected',
      'failed',
      'aborted',
      'timeout',
      'never_received',
      'zero_hz',
    ].includes(value)
  ) {
    return 'bad'
  }
  if (['accepted', 'executing', 'result_waiting'].includes(value)) {
    return 'info'
  }
  return 'muted'
}
