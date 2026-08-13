import {
  changeFirstQosMode,
  changeQosProfile,
  firstQosMode,
  linkedQosControls,
  qosProfilesByKey,
} from '../model/qosControlLinks.js'
import { useLinkedQosModes } from './useLinkedQosModes.js'

export function useInterfaceQosLinks({ action, service, topic }) {
  const topicQosLink = useLinkedQosModes({
    executionMode: topic.executionMode,
    executionProfiles: { topic: topic.executionProfile },
    receiveMode: topic.receiveMode,
    receiveProfiles: { topic: topic.receiveProfile },
    setExecutionMode: topic.setExecutionMode,
    setExecutionProfile: (_key, profile) => topic.setExecutionProfile(profile),
    setReceiveMode: topic.setReceiveMode,
    setReceiveProfile: (_key, profile) => topic.setReceiveProfile(profile),
  })

  const serviceQosLink = useLinkedQosModes({
    executionMode: service.executionMode,
    executionProfiles: { service: service.executionProfile },
    receiveMode: service.receiveMode,
    receiveProfiles: { service: service.receiveProfile },
    setExecutionMode: service.setExecutionMode,
    setExecutionProfile: (_key, profile) => service.setExecutionProfile(profile),
    setReceiveMode: service.setReceiveMode,
    setReceiveProfile: (_key, profile) => service.setReceiveProfile(profile),
  })

  const actionQosLink = useLinkedQosModes({
    executionMode: firstQosMode(action.executionControls),
    executionProfiles: qosProfilesByKey(action.executionControls),
    receiveMode: firstQosMode(action.receiveControls),
    receiveProfiles: qosProfilesByKey(action.receiveControls),
    setExecutionMode: (mode) => changeFirstQosMode(action.executionControls, mode),
    setExecutionProfile: (key, profile) => changeQosProfile(action.executionControls, key, profile),
    setReceiveMode: (mode) => changeFirstQosMode(action.receiveControls, mode),
    setReceiveProfile: (key, profile) => changeQosProfile(action.receiveControls, key, profile),
  })

  return {
    actionQosLink,
    linkedActionExecutionQosControls: linkedQosControls(
      action.executionControls,
      actionQosLink,
      'execution',
    ),
    linkedActionReceiveQosControls: linkedQosControls(
      action.receiveControls,
      actionQosLink,
      'receive',
    ),
    serviceQosLink,
    topicQosLink,
  }
}
