import { useEffect, useState } from 'react'
import {
  formatAge,
  formatNumber,
  formatRelativeTime,
} from '../utils/format.js'
import { withExecutionNode } from '../utils/participants.js'
import { displayText } from '../utils/displayText.js'
import { ConnectionNodeList } from './ConnectionNodeList.jsx'
import { DetailSection } from './DetailSection.jsx'
import { KeyValueTable } from './KeyValueTable.jsx'
import { QosDetails } from './QosDetails.jsx'
import { QosSummaryNotice } from './QosSummary.jsx'
import { StatusBadge } from './StatusBadge.jsx'

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
  const neverReceived =
    hzData?.status === 'never_received' || latestData?.received === false

  return (
    <aside className="detail-panel">
      <div className="panel-heading">
        <span>Topic 상세</span>
        <div className="detail-panel-heading-actions">
          <StatusBadge value={topic.status} />
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
        <p className="notice-text warning">
          이 Topic은 아직 메시지를 수신하지 않았습니다. 발행자가 메시지를
          발행 중인지 확인하세요.
        </p>
      )}

      <DetailSection title="상태 요약">
        <DetailLine label="이름" value={topic.name} />
        <DetailLine label="타입" value={topic.types?.[0] ?? '-'} />
        <DetailLine label="상태" tone={statusTone(topic.status)} value={displayText(topic.status)} />
        <DetailLine label="상태 이유" value={displayText(topic.reason)} />
        <DetailLine
          label="마지막 확인"
          value={formatRelativeTime(topic.last_updated)}
        />
      </DetailSection>

      {cameraType && (
        <CameraPreview
          data={cameraData}
          hz={hzData?.hz}
          metadata={cameraData?.metadata ?? preview}
          topicName={topic.name}
          topicType={topic.types?.[0]}
        />
      )}

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

function CameraPreview({ data, hz, metadata, topicName, topicType }) {
  const [expanded, setExpanded] = useState(false)
  const image = data?.preview
  const ready = image?.status === 'ready' && image.data_url
  const encoding = metadata?.encoding ?? metadata?.format ?? '-'
  return (
    <DetailSection title="Image Preview">
      <div className="camera-preview-frame">
        {ready ? (
          <button
            aria-label="Camera 이미지 크게 보기"
            className="camera-preview-open"
            onClick={() => setExpanded(true)}
            title="클릭하여 크게 보기"
            type="button"
          >
            <img alt="Camera Topic preview" src={image.data_url} />
          </button>
        ) : (
          <div className="camera-preview-empty">
            {cameraPreviewMessage(image)}
          </div>
        )}
      </div>
      {ready && <p className="camera-preview-hint">이미지를 클릭하면 크게 볼 수 있습니다.</p>}
      <div className="camera-preview-meta">
        <DetailLine label="Type" value={topicType ?? '-'} />
        {metadata?.width != null && (
          <DetailLine label="Width" value={metadata.width} />
        )}
        {metadata?.height != null && (
          <DetailLine label="Height" value={metadata.height} />
        )}
        <DetailLine label="Encoding / Format" value={encoding} />
        <DetailLine
          label="수신 시각"
          value={formatRelativeTime(data?.frame_received_at ?? data?.last_received_at)}
        />
        <DetailLine label="Hz" value={formatNumber(hz)} />
        {metadata?.header?.frame_id && (
          <DetailLine label="Frame ID" value={metadata.header.frame_id} />
        )}
      </div>
      {expanded && ready && (
        <CameraPreviewModal
          dataUrl={image.data_url}
          onClose={() => setExpanded(false)}
          topicName={topicName}
        />
      )}
    </DetailSection>
  )
}

function CameraPreviewModal({ dataUrl, onClose, topicName }) {
  const [viewMode, setViewMode] = useState('fit')
  const [zoom, setZoom] = useState(100)

  const changeZoom = (amount) => {
    setViewMode('zoom')
    setZoom((current) => Math.min(400, Math.max(25, current + amount)))
  }

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <div
      aria-label="Camera 이미지 확대"
      aria-modal="true"
      className="preview-modal-backdrop camera-preview-modal-backdrop"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="preview-modal camera-preview-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="preview-modal-header">
          <div>
            <strong>Camera Image Preview</strong>
            <span>{topicName}</span>
          </div>
          <button
            aria-label="팝업 닫기"
            className="preview-modal-close"
            onClick={onClose}
            type="button"
          >
            닫기
          </button>
        </div>
        <div aria-label="이미지 크기 조절" className="camera-preview-modal-toolbar">
          <button
            aria-label="이미지 축소"
            disabled={viewMode === 'zoom' && zoom <= 25}
            onClick={() => changeZoom(-25)}
            title="25% 축소"
            type="button"
          >
            −
          </button>
          <output aria-live="polite">
            {viewMode === 'fit' ? '화면 맞춤' : viewMode === 'original' ? '원본 크기' : `${zoom}%`}
          </output>
          <button
            aria-label="이미지 확대"
            disabled={viewMode === 'zoom' && zoom >= 400}
            onClick={() => changeZoom(25)}
            title="25% 확대"
            type="button"
          >
            +
          </button>
          <button
            className={viewMode === 'fit' ? 'active' : undefined}
            onClick={() => setViewMode('fit')}
            type="button"
          >
            화면 맞춤
          </button>
          <button
            className={viewMode === 'original' ? 'active' : undefined}
            onClick={() => setViewMode('original')}
            type="button"
          >
            원본 크기
          </button>
        </div>
        <div className="camera-preview-modal-image">
          <div
            className={`camera-preview-modal-canvas camera-preview-modal-canvas-${viewMode}`}
            style={viewMode === 'zoom' ? { width: `${zoom}%` } : undefined}
          >
            <img
              alt={`${topicName} Camera 확대 preview`}
              src={dataUrl}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function cameraPreviewMessage(preview) {
  if (preview?.error) return preview.error
  if (preview?.status === 'awaiting_frame') return '다음 Camera frame을 기다리는 중입니다.'
  return '이미지 preview가 아직 없습니다.'
}

function isCameraTopicType(topicType) {
  return [
    'sensor_msgs/msg/Image',
    'sensor_msgs/msg/CompressedImage',
  ].includes(topicType)
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
