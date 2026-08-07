import { useState } from 'react'
import { OverviewStatusCard } from '../components/OverviewStatusCard.jsx'
import { OverviewColumnChart } from '../features/overview/OverviewColumnChart.jsx'
import { OverviewPreviewGrid } from '../features/overview/OverviewPreviewGrid.jsx'
import {
  getActionSummary,
  getServiceSummary,
  getTopicSummary,
  overallStatus,
} from '../utils/status.js'
import { isPrimaryNode } from '../utils/nodeFilters.js'
import {
  applyAlertsToResourceSummary,
  getAlertSummary,
  getNodeSummary,
} from '../features/overview/overviewSummary.js'
import {
  isPrimaryAction,
  isPrimaryService,
  isPrimaryTopic,
} from '../utils/primaryFilters.js'

export function OverviewPage({
  actionDashboard,
  dashboard,
  nodeDashboard,
  onNavigate,
  serviceDashboard,
}) {
  const [chartValueMode, setChartValueMode] = useState('percent')
  const { alerts, setSelectedTopicName, topicItems } = dashboard
  const alertMeta = alerts.data?.meta ?? {}
  const alertItems = alerts.data?.data ?? []
  const activeAlertItems = alertItems.filter(
    (alert) => alert.alert_state !== 'resolved',
  )
  const primaryTopics = topicItems.filter((topic) => isPrimaryTopic(topic))
  const summary = applyAlertsToResourceSummary(
    getTopicSummary(primaryTopics),
    primaryTopics,
    activeAlertItems,
    new Set(['topic', 'monitor_status']),
  )
  const primaryServices = serviceDashboard.services.filter(isPrimaryService)
  const serviceSummary = applyAlertsToResourceSummary(
    getServiceSummary(primaryServices),
    primaryServices,
    activeAlertItems,
    new Set(['service']),
  )
  const primaryActions = actionDashboard.actions.filter(isPrimaryAction)
  const actionSummary = applyAlertsToResourceSummary(
    getActionSummary(primaryActions),
    primaryActions,
    activeAlertItems,
    new Set(['action']),
  )
  const primaryNodes = nodeDashboard.nodes.filter(
    (node) => isPrimaryNode(node, {
      actions: actionDashboard.actions,
      services: serviceDashboard.services,
      topics: topicItems,
    }),
  )
  const nodeSummary = applyAlertsToResourceSummary(
    getNodeSummary(primaryNodes),
    primaryNodes,
    activeAlertItems,
    new Set(['node']),
  )
  const alertSummary = getAlertSummary(alertMeta, activeAlertItems)
  const status = overallStatus(alertMeta)
  const chartItems = [
    {
      id: 'nodes',
      label: 'Node',
      total: nodeSummary.total,
      summary: {
        green: nodeSummary.active,
        yellow: nodeSummary.warning,
        red: nodeSummary.error + nodeSummary.inactive,
      },
    },
    {
      id: 'topics',
      label: 'Topic',
      total: summary.total,
      summary: {
        green: summary.active,
        yellow: summary.warning,
        red: summary.error + summary.inactive,
      },
    },
    {
      id: 'services',
      label: 'Service',
      total: serviceSummary.total,
      summary: {
        green: serviceSummary.active,
        yellow: serviceSummary.warning,
        red: serviceSummary.error + serviceSummary.inactive,
      },
    },
    {
      id: 'actions',
      label: 'Action',
      total: actionSummary.total,
      summary: {
        green: actionSummary.active,
        yellow: actionSummary.warning,
        red: actionSummary.error + actionSummary.inactive,
      },
    },
    {
      id: 'alerts',
      label: 'Alert',
      total: alertSummary.total,
      summary: {
        green: alertSummary.total ? 0 : 1,
        yellow: alertSummary.warning,
        red: alertSummary.error + alertSummary.critical,
      },
    },
  ]

  const openAlert = (alert) => {
    if (alert.source === 'topic' || alert.source === 'monitor_status') {
      setSelectedTopicName(alert.name)
      onNavigate('topics')
      return
    }

    if (alert.source === 'service') {
      serviceDashboard.setIncludeHidden(true)
      serviceDashboard.setSelectedServiceName(alert.name)
      onNavigate('services')
      return
    }

    if (alert.source === 'action') {
      actionDashboard.setIncludeIdleActions(true)
      actionDashboard.setSelectedActionName(alert.name)
      onNavigate('actions')
      return
    }

    if (alert.source === 'node' || alert.code === 'node_stale') {
      nodeDashboard.setIncludeInternalNodes(true)
      nodeDashboard.setStatusFilter('all')
      nodeDashboard.setSelectedNodeName(alert.name)
      onNavigate('nodes')
      return
    }

    onNavigate('alerts')
  }

  return (
    <main className="overview-page">
      <OverviewStatusCard alertMeta={alertMeta} status={status} />

      <OverviewPreviewGrid
        actionSummary={actionSummary}
        alertError={alerts.error}
        alerts={alertItems}
        nodeSummary={nodeSummary}
        onAlertClick={openAlert}
        onNavigate={onNavigate}
        serviceSummary={serviceSummary}
        topicSummary={summary}
      />

      <OverviewColumnChart
        items={chartItems}
        onNavigate={onNavigate}
        onValueModeChange={setChartValueMode}
        valueMode={chartValueMode}
      />
    </main>
  )
}
