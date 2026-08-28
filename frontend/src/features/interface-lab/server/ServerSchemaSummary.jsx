export function ServerSchemaSummary({ fields = [], title }) {
  return (
    <section className="interface-server-schema" aria-label={title}>
      <span className="interface-form-section-title">{title}</span>
      {fields.length ? (
        <dl>
          {fields.map((field) => (
            <div key={field.name ?? field.raw_line}>
              <dt>{field.name}</dt>
              <dd>{field.type}</dd>
            </div>
          ))}
        </dl>
      ) : <small>필드가 없는 schema입니다.</small>}
    </section>
  )
}
