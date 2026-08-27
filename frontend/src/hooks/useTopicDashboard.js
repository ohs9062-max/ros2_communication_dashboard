import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchAlerts,
  fetchHealth,
  fetchNodes,
  fetchTopicHz,
  fetchTopicImagePreview,
  fetchTopicLatest,
  fetchTopics,
  stopTopicImagePreview,
} from '../api/rosApi.js'
import {
  CAMERA_PREVIEW_POLL_INTERVAL_MS,
  DASHBOARD_POLL_INTERVAL_MS,
  TOPIC_POLL_INTERVAL_MS,
} from '../config/polling.js'
import { buildParticipantMaps } from '../utils/participants.js'
import { usePolling } from './usePolling.js'
import { useUserPriority } from './useUserPriority.js'

const topicName = (topic) => topic.resource_key ?? topic.name

export function useTopicDashboard({
  enabled = true,
  healthEnabled = true,
  pollSelectedTopicDetails = true,
} = {}) {
  const [includeAllTopics, setIncludeAllTopics] = useState(false)
  const [selectedTopicName, setSelectedTopicNameState] = useState('')
  const [cameraPreviewResourceKey, setCameraPreviewResourceKey] = useState('')
  const [topicHzByName, setTopicHzByName] = useState({})
  const [qosFocusRequest, setQosFocusRequest] = useState(null)
  const focusQosDetails = useCallback((name, channel = null) => {
    setQosFocusRequest({ channel, name, requestId: Date.now() })
  }, [])

  const health = usePolling(fetchHealth, TOPIC_POLL_INTERVAL_MS, {
    enabled: healthEnabled,
  })
  const topics = usePolling(fetchTopics, TOPIC_POLL_INTERVAL_MS, {
    enabled,
    initialData: { data: [], meta: {} },
  })
  const alerts = usePolling(fetchAlerts, TOPIC_POLL_INTERVAL_MS, {
    enabled,
    initialData: { data: [], meta: {} },
  })
  const nodeState = usePolling(fetchNodes, DASHBOARD_POLL_INTERVAL_MS, {
    enabled,
    initialData: { data: { nodes: [], meta: {} } },
  })
  const selectedTopicForRequest = useMemo(
    () => (topics.data?.data ?? []).find((topic) => (topic.resource_key ?? topic.name) === selectedTopicName) ?? null,
    [selectedTopicName, topics.data],
  )

  const latestFetcher = useCallback(
    () => fetchTopicLatest(selectedTopicForRequest?.name ?? '', selectedTopicForRequest?.domain_id),
    [selectedTopicForRequest],
  )
  const hzFetcher = useCallback(
    () => fetchTopicHz(selectedTopicForRequest?.name ?? '', selectedTopicForRequest?.domain_id),
    [selectedTopicForRequest],
  )

  const latest = usePolling(latestFetcher, TOPIC_POLL_INTERVAL_MS, {
    enabled: enabled && pollSelectedTopicDetails && Boolean(selectedTopicName),
    resetKey: selectedTopicName,
  })
  const hz = usePolling(hzFetcher, TOPIC_POLL_INTERVAL_MS, {
    enabled: enabled && pollSelectedTopicDetails && Boolean(selectedTopicName),
    resetKey: selectedTopicName,
  })

  const rawTopicItems = useMemo(() => topics.data?.data ?? [], [topics.data])
  const priority = useUserPriority({
    items: rawTopicItems,
    kind: 'topics',
    nameOf: topicName,
    refresh: topics.refresh,
  })
  const topicItems = priority.items
  const nodeItems = useMemo(
    () => nodeState.data?.data?.nodes ?? [],
    [nodeState.data],
  )
  const { topicParticipants } = useMemo(
    () => buildParticipantMaps(nodeItems, { excludeInternal: true }),
    [nodeItems],
  )
  const selectedTopic = useMemo(
    () => topicItems.find((topic) => (topic.resource_key ?? topic.name) === selectedTopicName) ?? null,
    [selectedTopicName, topicItems],
  )
  const cameraPreviewOpen = Boolean(selectedTopicName)
    && cameraPreviewResourceKey === selectedTopicName
  const setCameraPreviewOpen = useCallback((open) => {
    setCameraPreviewResourceKey(open ? selectedTopicName : '')
  }, [selectedTopicName])
  const setSelectedTopicName = useCallback((nextTopicName) => {
    setCameraPreviewResourceKey('')
    setSelectedTopicNameState(nextTopicName)
  }, [])
  const cameraPreviewFetcher = useCallback(
    () => fetchTopicImagePreview(selectedTopicForRequest?.name ?? '', selectedTopicForRequest?.domain_id),
    [selectedTopicForRequest],
  )
  const cameraPreview = usePolling(
    cameraPreviewFetcher,
    CAMERA_PREVIEW_POLL_INTERVAL_MS,
    {
      enabled:
        enabled &&
        pollSelectedTopicDetails &&
        cameraPreviewOpen &&
        isCameraTopicType(selectedTopic?.types?.[0]),
      resetKey: selectedTopicName,
    },
  )
  const activeCameraPreview =
    enabled
    && pollSelectedTopicDetails
    && cameraPreviewOpen
    && isCameraTopicType(selectedTopic?.types?.[0])
    ? selectedTopic
    : null
  const activeCameraPreviewName = activeCameraPreview?.name ?? ''
  const activeCameraPreviewDomainId = activeCameraPreview?.domain_id
  const activeCameraPreviewResourceKey = activeCameraPreview?.resource_key ?? ''

  useEffect(() => {
    if (!activeCameraPreviewName) return undefined
    return () => {
      // Closing/switching the detail releases Monitor-side Base64 immediately.
      // The request lease remains a fallback if the browser disappears first.
      void stopTopicImagePreview(activeCameraPreviewName, activeCameraPreviewDomainId).catch(() => {})
    }
  }, [activeCameraPreviewDomainId, activeCameraPreviewName, activeCameraPreviewResourceKey])
  const hzTopicTargets = useMemo(
    () =>
      topicItems
        .filter(isTopicDetailCandidate)
        .filter((topic) => topic.deep_monitoring)
        .filter((topic) => topic.name && topicName(topic) !== selectedTopicName)
        .map((topic) => ({
          domainId: topic.domain_id,
          key: topicName(topic),
          name: topic.name,
        }))
        .sort((left, right) => left.key.localeCompare(right.key)),
    [selectedTopicName, topicItems],
  )
  const hzTopicTargetsKey = useMemo(() => JSON.stringify(hzTopicTargets), [hzTopicTargets])
  const displayedTopicHzByName = useMemo(() => {
    if (
      !selectedTopicForRequest
      || hz.data?.data?.resource_key !== topicName(selectedTopicForRequest)
    ) {
      return topicHzByName
    }

    return {
      ...topicHzByName,
      [topicName(selectedTopicForRequest)]: hz.data,
    }
  }, [hz.data, selectedTopicForRequest, topicHzByName])

  useEffect(() => {
    const targets = hzTopicTargetsKey ? JSON.parse(hzTopicTargetsKey) : []
    if (!targets.length) {
      setTopicHzByName({})
      return undefined
    }

    let cancelled = false
    let pollInFlight = false

    async function pollTopicHz() {
      if (pollInFlight) {
        return
      }

      pollInFlight = true
      try {
        const results = await Promise.allSettled(
          targets.map(async (target) => [
            target.key,
            await fetchTopicHz(target.name, target.domainId),
          ]),
        )

        if (cancelled) {
          return
        }

        const nextHzByName = {}
        for (const result of results) {
          if (result.status === 'fulfilled') {
            const [name, data] = result.value
            nextHzByName[name] = data
          }
        }

        setTopicHzByName(nextHzByName)
      } finally {
        pollInFlight = false
      }
    }

    pollTopicHz()
    const timer = window.setInterval(
      pollTopicHz,
      TOPIC_POLL_INTERVAL_MS,
    )

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [hzTopicTargetsKey])

  const lastUpdated =
    topics.lastUpdated ??
    nodeState.lastUpdated ??
    alerts.lastUpdated ??
    health.lastUpdated

  return {
    alerts,
    cameraPreview,
    cameraPreviewOpen,
    health,
    hz,
    includeAllTopics,
    latest,
    lastUpdated,
    selectedTopic,
    selectedTopicName,
    qosFocusRequest,
    focusQosDetails,
    setIncludeAllTopics,
    setCameraPreviewOpen,
    setSelectedTopicName,
    topicHzByName: displayedTopicHzByName,
    topicItems,
    topicParticipants,
    topics,
    priorityError: priority.priorityError,
    toggleUserPriority: priority.toggleUserPriority,
    isPriorityPending: priority.isPriorityPending,
  }
}

function isCameraTopicType(topicType) {
  return [
    'sensor_msgs/msg/Image',
    'sensor_msgs/msg/CompressedImage',
  ].includes(topicType)
}

function isTopicDetailCandidate(topic) {
  const name = topic?.name ?? ''
  return !(
    name === '/clock' ||
    name === '/parameter_events' ||
    name === '/rosout' ||
    name === '/tf' ||
    name === '/tf_static' ||
    name.endsWith('/_action/status') ||
    name.endsWith('/_action/feedback') ||
    name.endsWith('/_service_event')
  )
}
