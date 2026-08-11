import { useMemo, useState } from 'react'

import {
  actionQosSelection,
  createManualQos,
  serviceQosSelection,
  topicQosSelection,
} from '../model/executionQos.js'

export function useExecutionQos() {
  const [qosMode, setQosMode] = useState('auto')
  const [qosProfile, setQosProfile] = useState(createManualQos)
  const qosSelection = useMemo(
    () => topicQosSelection(qosMode, qosProfile),
    [qosMode, qosProfile],
  )
  return { qosMode, qosProfile, qosSelection, setQosMode, setQosProfile }
}

export function useServiceExecutionQos() {
  const request = useExecutionQos()
  const response = useExecutionQos()
  const qosSelection = useMemo(
    () => serviceQosSelection(
      request.qosMode, request.qosProfile,
      response.qosMode, response.qosProfile,
    ),
    [request.qosMode, request.qosProfile, response.qosMode, response.qosProfile],
  )
  return {
    qosSelection,
    requestQosMode: request.qosMode,
    requestQosProfile: request.qosProfile,
    responseQosMode: response.qosMode,
    responseQosProfile: response.qosProfile,
    setRequestQosMode: request.setQosMode,
    setRequestQosProfile: request.setQosProfile,
    setResponseQosMode: response.setQosMode,
    setResponseQosProfile: response.setQosProfile,
  }
}

export function useActionExecutionQos() {
  const [qosMode, setQosMode] = useState('auto')
  const [goal, setGoal] = useState(createManualQos)
  const [result, setResult] = useState(createManualQos)
  const [cancel, setCancel] = useState(createManualQos)
  const [feedback, setFeedback] = useState(createManualQos)
  const [status, setStatus] = useState(createManualQos)
  const qosSelection = actionQosSelection({
    goal: { qosMode, qosProfile: goal },
    result: { qosMode, qosProfile: result },
    cancel: { qosMode, qosProfile: cancel },
    feedback: { qosMode, qosProfile: feedback },
    status: { qosMode, qosProfile: status },
  })
  return {
    qosSelection,
    qosControls: [
      actionControl('goal', 'Goal QoS', 'service', goal, setGoal, qosMode, setQosMode),
      actionControl('result', 'Result QoS', 'service', result, setResult, qosMode, setQosMode),
      actionControl('cancel', 'Cancel QoS', 'service', cancel, setCancel, qosMode, setQosMode),
      actionControl('feedback', 'Feedback QoS', 'topic', feedback, setFeedback, qosMode, setQosMode),
      actionControl('status', 'Status QoS', 'topic', status, setStatus, qosMode, setQosMode),
    ],
  }
}

function actionControl(key, label, group, profile, setProfile, mode, setMode) {
  return {
    group,
    key,
    label,
    mode,
    onModeChange: setMode,
    onProfileChange: setProfile,
    profile,
  }
}
