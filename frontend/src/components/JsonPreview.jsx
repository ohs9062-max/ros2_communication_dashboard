import { useEffect } from 'react'

export function JsonPreviewButton({ onOpen, value }) {
  if (value === undefined || value === null || value === '') {
    return <span className="muted">-</span>
  }

  return (
    <button
      className="table-preview-button"
      onClick={(event) => {
        event.stopPropagation()
        onOpen()
      }}
      title="전체 데이터 보기"
      type="button"
    >
      <code className="table-preview-text">{previewText(value)}</code>
    </button>
  )
}

export function JsonPreviewModal({ name, onClose, title, value }) {
  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <div
      aria-label={`${title} 상세`}
      aria-modal="true"
      className="preview-modal-backdrop"
      onClick={(event) => {
        event.stopPropagation()
        onClose()
      }}
      role="dialog"
    >
      <div
        className="preview-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="preview-modal-header">
          <div>
            <strong>{title}</strong>
            <span>{name}</span>
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
        <pre className="preview-json preview-modal-json">
          {fullPreviewText(value)}
        </pre>
      </div>
    </div>
  )
}

function previewText(value) {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function fullPreviewText(value) {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}
