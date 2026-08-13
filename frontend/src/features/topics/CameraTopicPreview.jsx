import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { DetailSection } from '../../components/DetailSection.jsx'
import { formatNumber, formatRelativeTime } from '../../utils/format.js'
import { centeredScrollPosition, nextCameraZoom } from './cameraPreviewModel.js'

export function CameraTopicPreview({ data, hz, metadata, topicName, topicType }) {
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
          <div className="camera-preview-empty">{cameraPreviewMessage(image)}</div>
        )}
      </div>
      {ready && <p className="camera-preview-hint">이미지를 클릭하면 크게 볼 수 있습니다.</p>}
      <div className="camera-preview-meta">
        <CameraMetaLine label="Type" value={topicType ?? '-'} />
        {metadata?.width != null && <CameraMetaLine label="Width" value={metadata.width} />}
        {metadata?.height != null && <CameraMetaLine label="Height" value={metadata.height} />}
        <CameraMetaLine label="Encoding / Format" value={encoding} />
        <CameraMetaLine
          label="수신 시각"
          value={formatRelativeTime(data?.frame_received_at ?? data?.last_received_at)}
        />
        <CameraMetaLine label="Hz" value={formatNumber(hz)} />
        {metadata?.header?.frame_id && (
          <CameraMetaLine label="Frame ID" value={metadata.header.frame_id} />
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
  const imageViewportRef = useRef(null)

  const centerImage = useCallback(() => {
    const viewport = imageViewportRef.current
    if (!viewport) return
    const position = centeredScrollPosition(viewport)
    viewport.scrollLeft = position.left
    viewport.scrollTop = position.top
  }, [])

  const changeZoom = (amount) => {
    setViewMode('zoom')
    setZoom((current) => nextCameraZoom(current, amount))
  }

  useLayoutEffect(() => {
    const frame = window.requestAnimationFrame(centerImage)
    return () => window.cancelAnimationFrame(frame)
  }, [centerImage, viewMode, zoom])

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
          <button
            aria-label="이미지를 화면 중앙에 정렬"
            onClick={centerImage}
            title="이미지 중심을 화면 중앙으로 이동"
            type="button"
          >
            중앙 정렬
          </button>
        </div>
        <div className="camera-preview-modal-image" ref={imageViewportRef}>
          <div
            className={`camera-preview-modal-canvas camera-preview-modal-canvas-${viewMode}`}
            style={viewMode === 'zoom' ? { width: `${zoom}%` } : undefined}
          >
            <img
              alt={`${topicName} Camera 확대 preview`}
              onLoad={centerImage}
              src={dataUrl}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function CameraMetaLine({ label, value }) {
  return (
    <div className="detail-line">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function cameraPreviewMessage(preview) {
  if (preview?.error) return preview.error
  if (preview?.status === 'awaiting_frame') return '다음 Camera frame을 기다리는 중입니다.'
  return '이미지 preview가 아직 없습니다.'
}
