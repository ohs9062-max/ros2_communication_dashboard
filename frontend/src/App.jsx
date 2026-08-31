import { lazy, Suspense } from 'react'
import './App.css'
import { AppShell } from './layout/AppShell.jsx'
import { useActionDashboard } from './hooks/useActionDashboard.js'
import { useMonitorWebSocket } from './hooks/useMonitorWebSocket.js'
import { useNodeDashboard } from './hooks/useNodeDashboard.js'
import { useServiceDashboard } from './hooks/useServiceDashboard.js'
import { useTopicDashboard } from './hooks/useTopicDashboard.js'
import { useBrowserRoute } from './hooks/useBrowserRoute.js'
import { useConfiguredDomains } from './hooks/useConfiguredDomains.js'

const OverviewPage = lazy(() => import('./pages/OverviewPage.jsx').then(({ OverviewPage: Page }) => ({ default: Page })))
const TopicsPage = lazy(() => import('./pages/TopicsPage.jsx').then(({ TopicsPage: Page }) => ({ default: Page })))
const AlertsPage = lazy(() => import('./pages/AlertsPage.jsx').then(({ AlertsPage: Page }) => ({ default: Page })))
const DomainsPage = lazy(() => import('./pages/DomainsPage.jsx').then(({ DomainsPage: Page }) => ({ default: Page })))
const NodesPage = lazy(() => import('./pages/NodesPage.jsx').then(({ NodesPage: Page }) => ({ default: Page })))
const ServicesPage = lazy(() => import('./pages/ServicesPage.jsx').then(({ ServicesPage: Page }) => ({ default: Page })))
const ActionsPage = lazy(() => import('./pages/ActionsPage.jsx').then(({ ActionsPage: Page }) => ({ default: Page })))
const VisualizationPage = lazy(() => import('./pages/VisualizationPage.jsx').then(({ VisualizationPage: Page }) => ({ default: Page })))
const InterfaceLabPage = lazy(() => import('./pages/InterfaceLabPage.jsx').then(({ InterfaceLabPage: Page }) => ({ default: Page })))

function App() {
  const { activePage, navigate, routeState } = useBrowserRoute()
  const topicDashboardEnabled = ['overview', 'topics', 'nodes', 'alerts'].includes(activePage)
  const serviceDashboardEnabled = ['overview', 'services', 'nodes', 'alerts'].includes(activePage)
  const actionDashboardEnabled = ['overview', 'actions', 'nodes', 'alerts'].includes(activePage)
  const nodeDashboardEnabled = ['overview', 'nodes', 'alerts'].includes(activePage)
  const dashboard = useTopicDashboard({
    enabled: topicDashboardEnabled,
    pollSelectedTopicDetails: activePage === 'topics',
  })
  const serviceDashboard = useServiceDashboard({ enabled: serviceDashboardEnabled })
  const actionDashboard = useActionDashboard({ enabled: actionDashboardEnabled })
  const nodeDashboard = useNodeDashboard({ enabled: nodeDashboardEnabled })
  const configuredDomains = useConfiguredDomains({
    enabled: ['topics', 'services', 'actions', 'nodes'].includes(activePage),
  })
  const monitorWebSocket = useMonitorWebSocket()

  return (
    <AppShell
      activePage={activePage}
      dashboard={dashboard}
      onNavigate={navigate}
      websocket={monitorWebSocket}
    >
      <Suspense fallback={<PageLoading />}>
      {activePage === 'overview' && (
        <OverviewPage
          actionDashboard={actionDashboard}
          dashboard={dashboard}
          nodeDashboard={nodeDashboard}
          onNavigate={navigate}
          serviceDashboard={serviceDashboard}
        />
      )}
      {activePage === 'topics' && (
        <TopicsPage
          dashboard={dashboard}
          domainIds={configuredDomains.domainIds}
          onNavigate={navigate}
        />
      )}
      {activePage === 'alerts' && (
        <AlertsPage
          actionDashboard={actionDashboard}
          alertId={routeState?.alertId ?? null}
          dashboard={dashboard}
          nodeDashboard={nodeDashboard}
          onNavigate={navigate}
          serviceDashboard={serviceDashboard}
        />
      )}
      {activePage === 'domains' && <DomainsPage />}
      {activePage === 'nodes' && (
        <NodesPage
          actions={actionDashboard.actions}
          dashboard={nodeDashboard}
          domainIds={configuredDomains.domainIds}
          onNavigate={navigate}
          services={serviceDashboard.services}
          topics={dashboard.topicItems}
        />
      )}
      {activePage === 'services' && (
        <ServicesPage
          dashboard={serviceDashboard}
          domainIds={configuredDomains.domainIds}
          onNavigate={navigate}
        />
      )}
      {activePage === 'actions' && (
        <ActionsPage
          dashboard={actionDashboard}
          domainIds={configuredDomains.domainIds}
          onNavigate={navigate}
        />
      )}
      {activePage === 'visualization' && (
        <VisualizationPage websocket={monitorWebSocket} />
      )}
      {activePage === 'interfaceLab' && (
        <InterfaceLabPage websocket={monitorWebSocket} />
      )}
      </Suspense>
    </AppShell>
  )
}

function PageLoading() {
  return (
    <main className="page-loading" aria-busy="true" aria-live="polite">
      화면을 불러오는 중…
    </main>
  )
}

export default App
