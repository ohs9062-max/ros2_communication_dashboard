export function DetailSection({ children, collapsible = false, defaultOpen = false, detailsRef, title }) {
  if (collapsible) {
    return (
      <details className="detail-section detail-section-collapsible" open={defaultOpen} ref={detailsRef}>
        <summary>{title}</summary>
        <div className="detail-section-body">
          {children}
        </div>
      </details>
    )
  }

  return (
    <section className="detail-section">
      <h3>{title}</h3>
      {children}
    </section>
  )
}
