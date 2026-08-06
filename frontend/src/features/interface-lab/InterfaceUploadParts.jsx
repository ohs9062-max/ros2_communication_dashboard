/* oxlint-disable react/only-export-components */

const MANUAL_DEFINITION_EXAMPLES = {
  msg: '예:\nuint8 cmd\nbool success\nstring message',
  srv: '예:\nuint8 cmd\n---\nbool success\nstring message',
  action: '예:\nuint8 command\n---\nbool success\n---\nstring status',
}

export function PackageRegistry({ onDelete, packages }) {
  if (!packages.length) {
    return <small>업로드된 interface package가 없습니다.</small>
  }
  return (
    <div className="interface-package-list">
      {packages.map((item) => (
        <details className="interface-package-card" key={item.name} open>
          <summary>
            <span>
              <strong>{item.name}</strong>
              <small>{packageStatusLabel(item)}</small>
            </span>
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
            <dt>path</dt>
            <dd>{item.path}</dd>
            <dt>source</dt>
            <dd>{item.source}</dd>
            <dt>uploaded_at</dt>
            <dd>{item.uploaded_at}</dd>
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

export function ManualInterfacePanel({
  disabled,
  editingManualDefinition,
  manualDefinition,
  manualKind,
  manualMode,
  manualType,
  manualTypeName,
  onCancelEdit,
  onDefinitionChange,
  onKindChange,
  onModeChange,
  onSubmitDefinition,
  onSubmitType,
  onTypeChange,
  onTypeNameChange,
  onValidateDefinition,
}) {
  return (
    <div className="interface-manual-panel">
      <div className="interface-manual-tabs">
        <button className={manualMode === 'type' ? 'active' : ''} onClick={() => onModeChange('type')} type="button">
          기존 빌드 타입 등록
        </button>
        <button className={manualMode === 'definition' ? 'active' : ''} onClick={() => onModeChange('definition')} type="button">
          인터페이스 직접 작성
        </button>
      </div>
      {manualMode === 'type' ? (
        <div className="interface-manual-form">
          <p className="interface-package-help">
            다른 ROS2 워크스페이스에서 이미 빌드되어 현재 환경에서 import 가능한 인터페이스 타입을 등록합니다.
            .msg, .srv, .action 파일을 새로 생성하거나 colcon build를 수행하지 않습니다.
          </p>
          <label className="interface-service-field">
            <span>full type</span>
            <input placeholder="예: rths_interfaces/srv/ScheduleCrud" value={manualType} onChange={(event) => onTypeChange(event.target.value)} />
          </label>
          <button className="interface-service-call-button" disabled={disabled} onClick={onSubmitType} type="button">타입 등록</button>
        </div>
      ) : (
        <div className="interface-manual-form">
          <p className="interface-package-help">
            .msg/.srv/.action 파일을 uploaded_interfaces 패키지에 직접 생성합니다. 저장 전 문법 검증을 수행하며, 저장 후 적용하기 build가 필요합니다.
          </p>
          {editingManualDefinition && (
            <div className="interface-service-state warning">수정 중: {editingManualDefinition.kind}/{editingManualDefinition.typeName}</div>
          )}
          <div className="interface-manual-fixed-path">
            저장 위치: ros2_ws/src/uploaded_interfaces/generated_interfaces/{manualKind}/{manualTypeName || 'TypeName'}.{manualKind}
          </div>
          <label className="interface-service-field">
            <span>kind</span>
            <select value={manualKind} onChange={(event) => onKindChange(event.target.value)}>
              <option value="msg">msg</option><option value="srv">srv</option><option value="action">action</option>
            </select>
          </label>
          <label className="interface-service-field">
            <span>type name</span>
            <input placeholder="예: MyControl" value={manualTypeName} onChange={(event) => onTypeNameChange(event.target.value)} />
          </label>
          <label className="interface-service-field">
            <span>definition</span>
            <textarea placeholder={MANUAL_DEFINITION_EXAMPLES[manualKind]} rows="8" value={manualDefinition} onChange={(event) => onDefinitionChange(event.target.value)} />
          </label>
          <div className="interface-receive-actions">
            <button className="interface-receive-action-button ghost" disabled={disabled} onClick={onValidateDefinition} type="button">문법 검증</button>
            <button className="interface-receive-action-button primary" disabled={disabled} onClick={onSubmitDefinition} type="button">
              {editingManualDefinition ? '인터페이스 수정 저장' : '인터페이스 저장'}
            </button>
            {editingManualDefinition && <button className="interface-receive-action-button" disabled={disabled} onClick={onCancelEdit} type="button">수정 취소</button>}
          </div>
        </div>
      )}
    </div>
  )
}

export function InterfaceUploadToolbar({
  applying,
  busy,
  disabled,
  feedback,
  inputRef,
  onApply,
  onFile,
  onOpenAction,
  onOpenPackages,
  onOpenReceive,
  onOpenRegistry,
  onOpenService,
  onOpenTopic,
  onPackageFile,
  onPackageFolder,
  onReplaceChange,
  onToggleManual,
  packageFolderInputRef,
  packageInputRef,
  reloadPhase,
  replacePackage,
  websocketStatus,
}) {
  return (
    <>
      <input accept=".msg,.srv,.action" className="interface-file-input" onChange={onFile} ref={inputRef} type="file" />
      <input accept=".zip" className="interface-file-input" onChange={onPackageFile} ref={packageInputRef} type="file" />
      <input className="interface-file-input" directory="" multiple onChange={onPackageFolder} ref={packageFolderInputRef} type="file" webkitdirectory="" />
      <button className="interface-type-entry-badge" disabled={disabled} onClick={onToggleManual} type="button">타입 기입</button>
      <button className="interface-upload-button" disabled={disabled} onClick={() => inputRef.current?.click()} type="button">
        {busy ? '처리 중…' : '타입 업로드'}
      </button>
      <button className="interface-package-button" disabled={disabled} onClick={() => packageInputRef.current?.click()} type="button">Package zip 업로드</button>
      <button className="interface-package-folder-button" disabled={disabled} onClick={() => packageFolderInputRef.current?.click()} type="button">Package 폴더 업로드</button>
      <label className="interface-package-replace">
        <input checked={replacePackage} disabled={disabled} onChange={(event) => onReplaceChange(event.target.checked)} type="checkbox" />
        <span>replace</span>
      </label>
      <button className="interface-apply-button" disabled={disabled} onClick={onApply} type="button">{applying ? '빌드 중…' : '적용하기'}</button>
      <button className="interface-registry-button" disabled={disabled} onClick={onOpenRegistry} type="button">등록 목록</button>
      <button className="interface-package-list-button" disabled={disabled} onClick={onOpenPackages} type="button">Package 목록</button>
      <button className="interface-topic-button" disabled={disabled} onClick={onOpenTopic} type="button">Topic 실행</button>
      <button className="interface-service-button" disabled={disabled} onClick={onOpenService} type="button">Service 실행</button>
      <button className="interface-action-button" disabled={disabled} onClick={onOpenAction} type="button">Action 실행</button>
      <button className="interface-receive-button" disabled={disabled} onClick={onOpenReceive} type="button">수신</button>
      {reloadPhase !== 'idle' && (
        <span className="interface-reload-state" role="status">{websocketStatus === 'connected' ? 'reload 대기' : '서버 재연결 중'}</span>
      )}
      {feedback && <span className={`interface-upload-feedback ${feedback.tone}`} role="status">{feedback.text}</span>}
    </>
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
    ['fields', parsed.fields],
    ['request', parsed.request],
    ['response', parsed.response],
    ['goal', parsed.goal],
    ['result', parsed.result],
    ['feedback', parsed.feedback],
  ].filter(([, fields]) => Array.isArray(fields) && fields.length)

  if (!sections.length) {
    return item.parsed_error ? <small>{item.parsed_error}</small> : null
  }

  return (
    <div className="interface-package-schema">
      {sections.map(([section, fields]) => (
        <div key={section}>
          <small>{section}</small>
          {fields.map((field) => (
            <code key={`${section}-${field.name}-${field.type}`}>
              {field.type} {field.name}
            </code>
          ))}
        </div>
      ))}
    </div>
  )
}

export function interfaceCounts(interfaces = {}) {
  return {
    msg: interfaces.msg?.length ?? 0,
    srv: interfaces.srv?.length ?? 0,
    action: interfaces.action?.length ?? 0,
  }
}

export function packageStatusLabel(item) {
  if (item.import_available) return 'import됨'
  if (item.last_build_status === 'failed') return '빌드 실패'
  if (item.last_build_status === 'success') return 'import 안됨'
  return item.rebuild_required ? 'build 필요' : '업로드됨'
}

export function ActionGoalResult({ result }) {
  return (
    <div className="interface-action-result">
      <span className={result.accepted ? 'success' : 'error'}>
        {result.accepted ? 'accepted' : 'rejected/failed'}
      </span>
      {Array.isArray(result.feedback) && result.feedback.length > 0 && (
        <div className="interface-action-feedback">
          <span>feedback</span>
          <ul>
            {result.feedback.map((item, index) => (
              <li key={`${index}-${JSON.stringify(item)}`}>
                <code>{JSON.stringify(item)}</code>
              </li>
            ))}
          </ul>
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
        <div className="interface-validation-warning">
          입력값이 선택한 ROS2 타입과 맞지 않아 전송하지 않았습니다.
        </div>
      )}
      <pre className={`interface-service-result ${result.success ? 'success' : 'error'}`}>
        {JSON.stringify(result.success ? successPayload : result, null, 2)}
      </pre>
    </>
  )
}

export function RequestField({ disabled = false, field, onChange, value }) {
  if (!field.name) {
    return null
  }
  const type = field.type ?? ''
  if (type === 'bool' || type === 'boolean') {
    return (
      <label className="interface-service-field inline">
        <input
          checked={Boolean(value)}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          type="checkbox"
        />
        <span>{field.name}</span>
      </label>
    )
  }
  if (isComplexType(type)) {
    return (
      <label className="interface-service-field">
        <span>{field.name} <small>{type} · JSON</small></span>
        <textarea
          disabled={disabled}
          onChange={(event) => {
            try {
              onChange(JSON.parse(event.target.value || 'null'))
            } catch {
              onChange(event.target.value)
            }
          }}
          rows={type.includes('[') || type.startsWith('sequence<') ? 4 : 3}
          value={typeof value === 'string' ? value : JSON.stringify(value ?? defaultFieldValue(type), null, 2)}
        />
      </label>
    )
  }
  const numeric = isNumericType(type)
  return (
    <label className="interface-service-field">
      <span>{field.name} <small>{type}</small></span>
      <input
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        type={numeric ? 'number' : 'text'}
        value={value ?? ''}
      />
    </label>
  )
}

export function ServiceCallHistory({ calls }) {
  if (!calls.length) {
    return null
  }
  return (
    <div className="interface-service-history">
      <span>최근 실행</span>
      <ul>
        {calls.slice(0, 3).map((call) => (
          <li key={`${call.called_at}-${call.service_name}`}>
            {call.service_name} · {call.success ? '성공' : '실패'} · {Math.round(call.elapsed_ms ?? 0)}ms
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ActionGoalHistory({ goals }) {
  if (!goals.length) {
    return null
  }
  return (
    <div className="interface-service-history">
      <span>최근 Goal</span>
      <ul>
        {goals.slice(0, 3).map((goal) => (
          <li key={`${goal.sent_at}-${goal.action_name}`}>
            {goal.action_name} · {goal.accepted ? 'accepted' : 'rejected'} · {Math.round(goal.elapsed_ms ?? 0)}ms
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ReceiveHistory({ items = [], title }) {
  return (
    <div className="interface-receive-history">
      <strong>{title} · {items.length}개</strong>
      {items.length ? (
        <ul>
          {items.map((item, index) => (
            <li key={`${title}-${index}-${item.id ?? item.topic_name ?? item.service_name ?? item.action_name}`}>
              <span>
                {item.topic_name ?? item.service_name ?? item.action_name ?? item.direction ?? 'event'}
                {' · '}
                {item.status ?? (item.receiving ? 'receiving' : item.success === false ? 'failed' : 'ok')}
              </span>
              <pre>{JSON.stringify(item.last_message ?? item.message_json ?? item.response ?? item.result ?? item.feedback ?? item, null, 2)}</pre>
            </li>
          ))}
        </ul>
      ) : (
        <small>수신 이력이 없습니다.</small>
      )}
    </div>
  )
}

export function serviceKey(service) {
  return `${service.service_name || service.file_name}|${service.service_type}`
}

export function actionKey(action) {
  return `${action.action_name || action.file_name}|${action.action_type}`
}

export function messageKey(message) {
  return `${message.message_type ?? message.full_type ?? message.file_name}|${message.source ?? ''}`
}

export function topicStatusLabel(message) {
  if (message.import_available) return 'Publish 가능'
  return 'Publish 불가'
}

export function topicGraphStatusLabel(message) {
  return message.graph_topics?.length ? 'Graph Topic 있음' : 'Graph Topic 없음'
}

export function serviceStatusLabel(service) {
  if (service.callable) return '호출 가능'
  if (!service.import_available) return 'import 안됨'
  if (!service.server_available) return '서버 없음'
  return '호출 불가'
}

export function actionStatusLabel(action) {
  if (action.callable) return '호출 가능'
  if (!action.import_available) return 'import 안됨'
  if (!action.server_available) return '서버 없음'
  return '호출 불가'
}

export function defaultRequestValues(schema = []) {
  return Object.fromEntries(
    schema
      .filter((field) => field.name)
      .map((field) => [field.name, defaultFieldValue(field.type)]),
  )
}

export function normalizeNumericValues(values, schema = []) {
  const numericFields = new Set(
    schema
      .filter((field) => field.name && isNumericType(field.type))
      .map((field) => field.name),
  )
  return Object.fromEntries(
    Object.entries(values).map(([name, value]) => [
      name,
      numericFields.has(name) && value !== '' ? Number(value) : value,
    ]),
  )
}

export function defaultFieldValue(type = '') {
  if (type === 'bool' || type === 'boolean') return false
  if (isArrayType(type)) return []
  if (isCustomType(type)) return {}
  if (isNumericType(type)) return 0
  return ''
}

export function isNumericType(type = '') {
  return /^(?:u?int(?:8|16|32|64)|float(?:32|64)|double)$/.test(type)
}

export function isArrayType(type = '') {
  return /\[[0-9]*\]$/.test(type) || /^sequence<.+>$/.test(type)
}

export function isCustomType(type = '') {
  return /^[A-Za-z][A-Za-z0-9_]*\/(?:msg\/)?[A-Z][A-Za-z0-9_]*$/.test(type)
}

export function isComplexType(type = '') {
  return isArrayType(type) || isCustomType(type)
}

export function registryRowKey(item) {
  return `${item.source ?? 'single'}-${item.full_type ?? item.file_name}-${item.file_kind ?? ''}`
}

export function deletedRegistryItemsFor(kind, items = []) {
  return items.filter((item) => item.file_kind === kind)
}

export function RegistryGroup({ deletedItems = [], items = [], label, onDelete, onDeleteManual, onEditManual }) {
  const rows = [
    ...items,
    ...deletedItems.filter((deleted) =>
      !items.some((item) => registryRowKey(item) === registryRowKey(deleted)),
    ),
  ]
  return (
    <div className="interface-registry-group">
      <span>{label} ({items.length})</span>
      {rows.length ? (
        <ul>{rows.map((item) => (
          <li
            className={item.deletedMarker ? 'interface-registry-row deleted' : 'interface-registry-row'}
            key={registryRowKey(item)}
          >
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
