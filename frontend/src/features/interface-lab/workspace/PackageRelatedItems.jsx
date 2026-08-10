export function PackageRelatedItems({ item, onSelect, relatedItems }) {
  return (
    <>
      <div className="interface-inline-heading">
        <strong>{item.title} 연결 항목</strong>
        <span>Service / Action을 누르면 여기서 바로 상세와 실행 폼을 봅니다.</span>
      </div>
      <div className="interface-related-grid">
        {relatedItems.length ? relatedItems.map((related) => (
          <button key={related.id} onClick={() => onSelect(related)} type="button">
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
  )
}
