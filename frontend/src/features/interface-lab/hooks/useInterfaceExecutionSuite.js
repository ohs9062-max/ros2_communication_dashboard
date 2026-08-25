import { useRef, useState } from 'react'

import { useActionExecutionController } from './useActionExecutionController.js'
import { useInterfaceReceiveController } from './useInterfaceReceiveController.js'
import { useServiceExecutionController } from './useServiceExecutionController.js'
import { useTopicExecutionController } from './useTopicExecutionController.js'

export function useInterfaceExecutionSuite({ onStateChanged, setBusy, setFeedback }) {
  const [availableTopics, setAvailableTopics] = useState([])
  // Selection is shared between the paired execution/receive controls.  Runtime
  // state deliberately remains inside each controller: receiving must never
  // make a Service call or Action goal look busy.
  const topicMessageSelectRef = useRef(null)
  const topicGraphSelectRef = useRef(null)
  const serviceSelectRef = useRef(null)
  const actionSelectRef = useRef(null)

  const receive = useInterfaceReceiveController({
    availableTopics,
    onActionSelectionChange: (key) => actionSelectRef.current?.(key),
    onMessageSelectionChange: (key) => topicMessageSelectRef.current?.(key),
    onServiceSelectionChange: (key) => serviceSelectRef.current?.(key),
    onTopicSelectionChange: (topic) => topicGraphSelectRef.current?.(topic),
    setAvailableTopics,
    setBusy,
    setFeedback,
  })
  const topic = useTopicExecutionController({
    availableTopics,
    onGraphTopicSelectionChange: receive.selectTopicFromExecution,
    onMessageSelectionChange: receive.selectMessageFromExecution,
    onStateChanged,
    setFeedback,
  })
  const service = useServiceExecutionController({
    onSelectionChange: receive.selectServiceFromExecution,
    onStateChanged,
  })
  const action = useActionExecutionController({
    onSelectionChange: receive.selectActionFromExecution,
    onStateChanged,
  })

  topicMessageSelectRef.current = topic.select
  topicGraphSelectRef.current = topic.selectGraphTopicFromReceive
  serviceSelectRef.current = service.select
  actionSelectRef.current = action.select

  return {
    action,
    availableTopics,
    receive,
    service,
    topic,
  }
}
