import { useEffect, useMemo, useState } from 'react'
import { AlertsPreview } from '../components/AlertsPreview.jsx'
import { ServiceDetailPanel } from '../components/ServiceDetailPanel.jsx'
import { ServiceSummaryCards } from '../components/ServiceSummaryCards.jsx'
import { ServiceTable } from '../components/ServiceTable.jsx'
import { ServiceFilterToolbar } from '../features/services/ServiceFilterToolbar.jsx'
import { filterServices, getPrimaryServices, getServiceUiSummary } from '../features/services/serviceFilters.js'

export function ServicesPage({ dashboard }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('primary')
  const {
    alerts,
    error,
    includeHidden,
    loading,
    meta,
    selectedService,
    selectedServiceName,
    serviceAlerts,
    serviceParticipants,
    services,
    setIncludeHidden,
    setSelectedServiceName,
    priorityError,
    toggleUserPriority,
    isPriorityPending,
  } = dashboard

  const primaryServices = useMemo(
    () => getPrimaryServices(services),
    [services],
  )
  const summary = useMemo(
    () => getServiceUiSummary(services, primaryServices, meta),
    [meta, primaryServices, services],
  )

  const filteredServices = useMemo(() => {
    return filterServices({ primaryServices, search, services, statusFilter })
  }, [primaryServices, search, services, statusFilter])

  useEffect(() => {
    setIncludeHidden(statusFilter === 'internal')
  }, [setIncludeHidden, statusFilter])

  useEffect(() => {
    if (filteredServices.some((service) => service.name === selectedServiceName)) {
      return
    }

    setSelectedServiceName(filteredServices[0]?.name ?? '')
  }, [filteredServices, selectedServiceName, setSelectedServiceName])

  const detailService = filteredServices.some(
    (service) => service.name === selectedServiceName,
  )
    ? selectedService
    : null
  const openServiceAlert = (alert) => {
    setIncludeHidden(true)
    setSearch('')
    setStatusFilter('all')
    setSelectedServiceName(alert.name)
    focusMonitorRow(alert.name, setSelectedServiceName)
  }

  return (
    <main className="topics-page">
      <section className="main-panel">
        <ServiceSummaryCards
          meta={meta}
          primaryServices={primaryServices}
          services={services}
          summary={summary}
        />
        <AlertsPreview
          alerts={serviceAlerts}
          emptyMessage="Service 알림 없음"
          error={alerts.error}
          onAlertClick={openServiceAlert}
          title="Service Alert"
        />

        <section className="topic-section">
          <div className="section-heading">
            <div>
              <h2>Service 상세</h2>
              <p className="muted">
                기본 화면은 등록된 주요 Service와 대기/오류 상태처럼 먼저
                확인해야 하는 Service만 표시합니다. 실제 요청/응답 확인은
                Interface Lab에서 사용자가 직접 호출한 기록을 사용합니다.
                Server·Client Node 수에서는 Dashboard가 테스트를 위해 만든
                통신을 제외합니다.
              </p>
            </div>
            {loading && <span className="muted">로딩 중</span>}
            {error && <span className="error-text">Service API 연결 실패</span>}
          </div>

          <ServiceFilterToolbar
            search={search}
            setSearch={setSearch}
            setStatusFilter={setStatusFilter}
            statusFilter={statusFilter}
          />

          <ServiceTable
            emptyMessage={
              statusFilter === 'internal' || includeHidden
                ? '표시할 Service가 없습니다'
                : "현재 주요 Service가 없습니다. 전체 목록은 '전체' 또는 '내부/관리 포함' 탭에서 확인하세요."
            }
            onSelectService={setSelectedServiceName}
            selectedServiceName={selectedServiceName}
            services={filteredServices}
            onTogglePriority={toggleUserPriority}
            isPriorityPending={isPriorityPending}
          />
          {priorityError && <p className="error-text">{priorityError}</p>}
        </section>
      </section>

      <ServiceDetailPanel
        participants={serviceParticipants[detailService?.name] ?? null}
        service={detailService}
      />
    </main>
  )
}

function focusMonitorRow(name, select) {
  window.setTimeout(() => focusMonitorRowAttempt(name, select, 0), 50)
}

function focusMonitorRowAttempt(name, select, attempt) {
  select(name)
  const row = findMonitorRow(name)
  if (row) {
    row.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
    return
  }

  if (attempt < 6) {
    window.setTimeout(() => focusMonitorRowAttempt(name, select, attempt + 1), 80)
  }
}

function findMonitorRow(name) {
  return [...document.querySelectorAll('[data-monitor-name]')].find(
    (row) => row.getAttribute('data-monitor-name') === name,
  )
}
