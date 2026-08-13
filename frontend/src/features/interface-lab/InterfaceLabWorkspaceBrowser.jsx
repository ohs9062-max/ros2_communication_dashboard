import { useMemo, useState } from 'react'

import { InlineWorkspace } from './workspace/InlineWorkspace.jsx'
import { InterfaceCard } from './workspace/WorkspaceCards.jsx'

const GROUPS = [
  { id: 'all', label: '전체' },
  { id: 'messages', label: 'Topic' },
  { id: 'services', label: 'Service' },
  { id: 'actions', label: 'Action' },
  { id: 'packages', label: 'Package' },
]

const STATUS_FILTERS = [
  { id: 'all', label: '모든 상태' },
  { id: 'callable', label: '실행 가능' },
  { id: 'importable', label: 'import됨' },
  { id: 'rebuild', label: 'build 필요' },
  { id: 'error', label: '오류' },
]

export function InterfaceLabWorkspaceBrowser({
  activeGroup,
  controller,
  onGroupChange,
  onHistorySelect,
  onExecute,
  onRelatedSelect,
  onSelect,
  relatedItems,
  selectedDetail,
  selectedHistoryItem,
  workspaceItems,
}) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    return workspaceItems.filter((item) => {
      if (query && ![item.title, item.subtitle, item.fullType, item.packageName]
        .some((value) => String(value ?? '').toLowerCase().includes(query))) return false
      if (statusFilter === 'callable') return item.callable === true || item.kind === 'message'
      if (statusFilter === 'importable') return item.importAvailable === true
      if (statusFilter === 'rebuild') return item.rebuildRequired === true
      if (statusFilter === 'error') return Boolean(item.error)
      return true
    })
  }, [search, statusFilter, workspaceItems])

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('all')
  }

  return (
    <section className={`interface-lab-layout${selectedDetail ? ' detail-open' : ''}`}>
      <div className="interface-registry-browser">
        <div className="filter-toolbar interface-browser-toolbar">
          <input aria-label="Interface 검색" onChange={(event) => setSearch(event.target.value)} placeholder="이름 또는 타입 검색" type="search" value={search} />
          <select aria-label="Interface 상태 필터" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
            {STATUS_FILTERS.map((filter) => <option key={filter.id} value={filter.id}>{filter.label}</option>)}
          </select>
        </div>
        <div className="interface-tabs" role="tablist" aria-label="Interface 종류">
          {GROUPS.map((group) => (
            <button className={activeGroup === group.id ? 'active' : ''} key={group.id} onClick={() => onGroupChange(group.id)} role="tab" type="button">{group.label}</button>
          ))}
        </div>
        <div className="interface-list-heading"><strong>Interface 목록</strong><span>{visibleItems.length}개</span></div>
        <div className="interface-card-list">
          {visibleItems.map((item) => <InterfaceCard item={item} key={item.id} onClick={() => onSelect(item)} selected={selectedDetail?.id === item.id} />)}
          {!visibleItems.length && (
            <div className="interface-empty-state">
              <p>{emptyMessage(activeGroup, search, statusFilter)}</p>
              {(search || statusFilter !== 'all') && <button className="interface-filter-reset-button" onClick={clearFilters} type="button">검색·상태 필터 초기화</button>}
            </div>
          )}
        </div>
      </div>

      {selectedDetail && (
        <aside className="interface-side-detail">
          <div className="interface-side-detail-heading">
            <div><strong>{selectedDetail.title}</strong><span title={selectedDetail.fullType}>{selectedDetail.fullType ?? selectedDetail.subtitle ?? '-'}</span></div>
            <div className="interface-side-detail-actions">
              <button aria-label="상세 닫기" className="interface-detail-close-button" onClick={() => onSelect(selectedDetail)} type="button">닫기 ×</button>
            </div>
          </div>
          <InlineWorkspace
            activeContinuousPublish={controller.activeContinuousPublish}
            actionQosControls={controller.actionQosControls}
            cancelingGoal={controller.cancelingGoal}
            executing={controller.executing}
            goalTimeoutSec={controller.goalTimeoutSec}
            goalValues={controller.goalValues}
            inlineResult={controller.result}
            item={selectedDetail}
            messageValues={controller.messageValues}
            onActionCancel={controller.cancelAction}
            onActionExecute={controller.executeAction}
            onGoalChange={controller.setGoalValues}
            onHistorySelect={onHistorySelect}
            onOpenExecution={() => onExecute(selectedDetail)}
            onMessageChange={controller.setMessageValues}
            onRelatedSelect={onRelatedSelect}
            onRequestChange={controller.setRequestValues}
            onServiceExecute={controller.executeService}
            onServiceRequestQosModeChange={controller.setServiceRequestQosMode}
            onServiceRequestQosProfileChange={controller.setServiceRequestQosProfile}
            onServiceResponseQosModeChange={controller.setServiceResponseQosMode}
            onServiceResponseQosProfileChange={controller.setServiceResponseQosProfile}
            onTopicContinuousStart={controller.startContinuousTopic}
            onTopicContinuousStop={controller.stopContinuousTopic}
            onTopicPublish={controller.publishTopic}
            onTopicReset={controller.resetTopicHistories}
            onServiceActionReset={controller.resetServiceActionHistories}
            onTopicSubscribeStart={controller.startTopicSubscribe}
            onTopicSubscribeStop={controller.stopTopicSubscribe}
            onTopicPublishQosModeChange={controller.setTopicPublishQosMode}
            onTopicPublishQosProfileChange={controller.setTopicPublishQosProfile}
            onTopicSubscribeQosModeChange={controller.setTopicSubscribeQosMode}
            onTopicSubscribeQosProfileChange={controller.setTopicSubscribeQosProfile}
            publishGraphTopics={controller.publishGraphTopics}
            relatedItems={relatedItems}
            requestValues={controller.requestValues}
            selectedHistoryItem={selectedHistoryItem}
            serviceRequestQosMode={controller.serviceRequestQosMode}
            serviceRequestQosProfile={controller.serviceRequestQosProfile}
            serviceResponseQosMode={controller.serviceResponseQosMode}
            serviceResponseQosProfile={controller.serviceResponseQosProfile}
            selectPublishGraphTopic={controller.selectPublishGraphTopic}
            setGoalTimeoutSec={controller.setGoalTimeoutSec}
            setTimeoutSec={controller.setTimeoutSec}
            setTopicPublishHz={controller.setTopicPublishHz}
            setTopicPublishName={controller.updateTopicPublishName}
            setTopicSubscribeName={controller.setTopicSubscribeName}
            timeoutSec={controller.timeoutSec}
            topicPublishHz={controller.topicPublishHz}
            topicPublishName={controller.topicPublishName}
            topicPublishWarning={controller.topicPublishWarning}
            topicPublishQosMode={controller.topicPublishQosMode}
            topicPublishQosProfile={controller.topicPublishQosProfile}
            topicSubscribeQosMode={controller.topicSubscribeQosMode}
            topicSubscribeQosProfile={controller.topicSubscribeQosProfile}
            topicSubscribeName={controller.topicSubscribeName}
          />
        </aside>
      )}
    </section>
  )
}

function emptyMessage(group, search, status) {
  if (search) return '검색 조건과 일치하는 Interface가 없습니다.'
  if (status === 'error') return '현재 오류가 있는 Interface가 없습니다.'
  if (group === 'services') return '등록되거나 발견된 Service가 없습니다.'
  if (group === 'actions') return '등록되거나 발견된 Action이 없습니다.'
  if (group === 'messages') return '등록되거나 발견된 Topic 타입이 없습니다.'
  if (group === 'packages') return '등록된 Package가 없습니다.'
  return '표시할 Interface가 없습니다.'
}
