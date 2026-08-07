import { packageStatusLabel, registryRowKey } from './model/interfaceUploadModel.js'

export function PackageRegistry({ onDelete, packages }) {
  if (!packages.length) return <small>업로드된 interface package가 없습니다.</small>
  return (
    <div className="interface-package-list">
      {packages.map((item) => (
        <details className="interface-package-card" key={item.name} open>
          <summary>
            <span><strong>{item.name}</strong><small>{packageStatusLabel(item)}</small></span>
            <button
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onDelete(item.name)
              }}
              type="button"
            >
              삭제
            </button>
          </summary>
          <dl>
            <dt>path</dt><dd>{item.path}</dd>
            <dt>source</dt><dd>{item.source}</dd>
            <dt>uploaded_at</dt><dd>{item.uploaded_at}</dd>
          </dl>
          <InterfaceTypeList items={item.interfaces?.msg} label="msg" />
          <InterfaceTypeList items={item.interfaces?.srv} label="srv" />
          <InterfaceTypeList items={item.interfaces?.action} label="action" />
          {item.import_error && <p className="interface-package-error">{item.import_error}</p>}
        </details>
      ))}
    </div>
  )
}

export function InterfaceTypeList({ items = [], label }) {
  return (
    <div className="interface-package-types">
      <span>{label} {items.length}</span>
      {items.length ? (
        <ul>
          {items.map((item) => (
            <li key={item.type}>
              <code>{item.type}</code>
              <small>{item.import_available ? 'import됨' : item.import_error || 'import 안됨'}</small>
              <InterfaceSchema item={item} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function InterfaceSchema({ item }) {
  const parsed = item.parsed ?? {}
  const sections = [
    ['fields', parsed.fields], ['request', parsed.request], ['response', parsed.response],
    ['goal', parsed.goal], ['result', parsed.result], ['feedback', parsed.feedback],
  ].filter(([, fields]) => Array.isArray(fields) && fields.length)

  if (!sections.length) return item.parsed_error ? <small>{item.parsed_error}</small> : null
  return (
    <div className="interface-package-schema">
      {sections.map(([section, fields]) => (
        <div key={section}>
          <small>{section}</small>
          {fields.map((field) => (
            <code key={`${section}-${field.name}-${field.type}`}>{field.type} {field.name}</code>
          ))}
        </div>
      ))}
    </div>
  )
}

export function RegistryGroup({ deletedItems = [], items = [], label, onDelete, onDeleteManual, onEditManual }) {
  const rows = [
    ...items,
    ...deletedItems.filter((deleted) =>
      !items.some((item) => registryRowKey(item) === registryRowKey(deleted))),
  ]
  return (
    <div className="interface-registry-group">
      <span>{label} ({items.length})</span>
      {rows.length ? (
        <ul>{rows.map((item) => (
          <li className={item.deletedMarker ? 'interface-registry-row deleted' : 'interface-registry-row'} key={registryRowKey(item)}>
            <div>
              {item.file_name}
              <small>
                {item.deletedMarker ? '삭제됨 · 최근 삭제 표시 · ' : ''}
                {item.source ? `${item.source} · ` : ''}
                {item.build?.file_saved ? '파일 생성됨' : '파일 미생성'} · {' '}
                {item.build?.cmake_registered ? 'CMake 등록됨' : 'CMake 미등록'} · {' '}
                {item.build?.package_xml_checked ? 'package.xml 확인됨' : 'package.xml 미확인'} · {' '}
                {item.build?.rebuild_required ? '재빌드 필요' : '빌드 반영'} · {' '}
                {item.build?.import_available ? 'import됨' : 'import 안됨'}
                {item.build?.saved_path ? ` · ${item.build.saved_path}` : ''}
                {item.build?.error ? ` · 오류: ${item.build.error}` : ''}
              </small>
            </div>
            {item.deletedMarker ? (
              <span className="interface-registry-deleted-badge">삭제됨</span>
            ) : (
              <div className="interface-receive-actions">
                {item.source === 'manual_definition' && (
                  <>
                    <button onClick={() => onEditManual?.(item)} type="button">수정</button>
                    <button onClick={() => onDeleteManual?.(item)} type="button">파일 삭제</button>
                  </>
                )}
                <button onClick={() => onDelete?.(item)} type="button">등록 삭제</button>
              </div>
            )}
          </li>
        ))}</ul>
      ) : <small>등록 없음</small>}
    </div>
  )
}
