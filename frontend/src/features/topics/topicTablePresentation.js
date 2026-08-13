import { compactDataPreview } from '../../utils/dataPreview.js'

export function createTopicSortColumns(hzByTopic) {
  return {
    status: { value: (topic) => topicDisplayStatus(topic, hzByTopic[topic.name]?.data) },
    name: { value: (topic) => topic.name },
    type: { value: (topic) => topic.types?.[0] },
    publisher_count: { defaultDirection: 'desc', value: (topic) => topic.publisher_node_count ?? topic.publisher_count ?? 0 },
    subscriber_count: { defaultDirection: 'desc', value: (topic) => topic.subscriber_node_count ?? topic.subscriber_count ?? 0 },
    hz: { defaultDirection: 'desc', value: (topic) => hzByTopic[topic.name]?.data?.hz },
    dashboard_communication: { defaultDirection: 'desc', value: (topic) => dashboardCommunicationCount(topic.dashboard_communication) },
    latest: { value: (topic) => compactDataPreview(topic.last_message_preview) },
    last_updated: { defaultDirection: 'desc', value: (topic) => topicLastCheckedAt(topic, hzByTopic[topic.name]?.data) },
  }
}

export function topicDashboardCommunicationItems(topic) {
  const state = topic.dashboard_communication ?? {}
  return [
    { active: state.auto_monitoring_active ?? topic.deep_monitoring, label: '자동 감시', tone: 'monitoring' },
    { active: state.interface_receive_active, label: 'Lab 수신', tone: 'receive' },
    { active: state.interface_publisher_created, label: 'Lab 발행', tone: 'publish' },
  ]
}

function dashboardCommunicationCount(state = {}) {
  return Object.values(state).filter((value) => value === true).length
}

export function hzState(hzData, topic) {
  if (topic.hz_monitoring_status === 'not_configured') return 'not-configured'
  if (topic.hz_monitoring_status === 'unsupported_type') return 'unsupported'
  if (topic.hz_monitoring_status === 'topic_not_discovered') return 'waiting'
  if (topic.hz_monitoring_status === 'subscription_failed') return 'failed'
  if (!topic.hz_monitoring_enabled) return 'not-configured'
  if (!hzData || hzData.status === 'never_received') return 'never'
  const hz = Number(hzData.hz ?? 0)
  if (!Number.isFinite(hz) || hz <= 0) return 'zero'
  if (hz < 10) return 'low'
  return 'normal'
}

export function hzLabel(hzData, state) {
  if (state === 'not-configured') return '감시 대상 아님'
  if (state === 'unsupported') return '타입 미지원'
  if (state === 'waiting') return 'Topic 미발견'
  if (state === 'failed') return '구독 실패'
  if (state === 'never') return '아직 수신 없음'
  return `${Number(hzData?.hz ?? 0).toFixed(2)} Hz`
}

export function topicLastCheckedAt(topic, hzData) {
  return topic.deep_monitoring
    ? hzData?.last_received_at ?? topic.last_received_at
    : topic.last_updated
}

export function topicDisplayStatus(topic, hzData) {
  if (topic.deep_monitoring === true) {
    if (hzData?.status === 'never_received' || hzData?.received === false) {
      return 'never_received'
    }
    if (hzData?.status === 'stale' || hzData?.stale === true) {
      return 'stale'
    }
  }
  return topic.status ?? 'unknown'
}

export function topicLastReceivedAt(topic, hzData) {
  return hzData?.last_received_at ?? topic.last_received_at
}

export function isMissingTopic(topic, hzEntry) {
  return topic.deep_monitoring === true && (
    hzEntry?.data?.status === 'never_received' || hzEntry?.data?.received === false
  )
}

export function topicCauseBadge(diagnosis) {
  if (!diagnosis) return null
  const displays = {
    subscription_failed: ['구독 생성 실패', 'bad'],
    qos_incompatible: [
      diagnosis.certainty === 'confirmed' ? 'QoS 불일치 확인' : 'QoS 불일치 가능',
      diagnosis.certainty === 'confirmed' ? 'bad' : 'warn',
    ],
    non_qos_receive_path: ['QoS 외 원인 확인', 'muted'],
    qos_unconfirmed: ['원인 확인 불가', 'muted'],
    publisher_data_stopped: ['데이터 중단', 'warn'],
    publisher_missing: ['Publisher 없음', 'warn'],
  }
  const [label, tone] = displays[diagnosis.cause] ?? ['원인 확인 필요', 'muted']
  return { label, tone }
}
