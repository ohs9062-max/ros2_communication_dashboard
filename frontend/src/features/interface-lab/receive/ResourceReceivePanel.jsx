import { ReceiveHistory } from '../InterfaceExecutionShared.jsx'
import { actionKey, serviceKey } from '../model/interfaceUploadModel.js'

const CONFIG = {
  action: {
    historyTitle: 'Action feedback/result receive history',
    key: actionKey,
    label: 'Action',
    name: (item) => item.action_name || item.file_name,
    placeholder: 'Action 이름 또는 type 검색',
    type: (item) => item.action_type,
  },
  service: {
    historyTitle: 'Service response receive history',
    key: serviceKey,
    label: 'Service',
    name: (item) => item.service_name || item.file_name,
    placeholder: 'Service 이름 또는 type 검색',
    type: (item) => item.service_type,
  },
}

export function ResourceReceivePanel({
  activeKey,
  history,
  items,
  kind,
  onRefresh,
  onResetAll,
  onResetSelected,
  onSearchChange,
  onSelect,
  onStart,
  onStop,
  search,
  selectedKey,
  visibleItems,
}) {
  const config = CONFIG[kind]
  const receiving = Boolean(selectedKey && activeKey === selectedKey)
  return (
    <div className="interface-receive-grid">
      <label className="interface-service-field">
        <span>항목 검색</span>
        <input placeholder={config.placeholder} value={search} onChange={(event) => onSearchChange(event.target.value)} />
      </label>
      <label className="interface-service-field">
        <span>{config.label} · {visibleItems.length}/{items.length}</span>
        <select value={selectedKey} onChange={(event) => onSelect(event.target.value)}>
          {visibleItems.map((item) => (
            <option key={config.key(item)} value={config.key(item)}>
              {config.name(item)} · {config.type(item)}
            </option>
          ))}
        </select>
        {!visibleItems.length && <small>검색 결과가 없습니다.</small>}
      </label>
      <ReceiveActions
        onRefresh={onRefresh}
        onResetAll={onResetAll}
        onResetSelected={onResetSelected}
        onStart={onStart}
        onStop={onStop}
        receiving={receiving}
        selected={Boolean(selectedKey)}
      />
      <ReceiveHistory title={config.historyTitle} items={history} />
    </div>
  )
}

function ReceiveActions({ onRefresh, onResetAll, onResetSelected, onStart, onStop, receiving, selected }) {
  return (
    <div className="interface-receive-actions">
      <button className={receiving ? 'interface-receive-action-button receiving' : 'interface-receive-action-button primary'} disabled={!selected || receiving} onClick={onStart} type="button">
        {receiving ? '수신 중' : '수신 시작'}
      </button>
      <button className="interface-receive-action-button" onClick={onStop} type="button">수신 중지</button>
      <button className="interface-receive-action-button warning" onClick={onResetSelected} type="button">선택 이력 리셋</button>
      <button className="interface-receive-action-button warning" onClick={onResetAll} type="button">전체 이력 리셋</button>
      <button className="interface-receive-action-button ghost" onClick={onRefresh} type="button">새로고침</button>
    </div>
  )
}
