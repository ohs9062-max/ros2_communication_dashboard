export function DetailSection({ children, collapsible = false, defaultOpen = false, detailsRef, onToggle, title }) {
  if (collapsible) {
    return (
      <details
        className="detail-section detail-section-collapsible"
        onToggle={(event) => onToggle?.(event.currentTarget.open)}
        open={defaultOpen}
        ref={detailsRef}
      >
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
