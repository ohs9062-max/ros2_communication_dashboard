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
  const topicDomainSelectRef = useRef(null)
  const serviceSelectRef = useRef(null)
  const serviceDomainSelectRef = useRef(null)
  const actionSelectRef = useRef(null)
  const actionDomainSelectRef = useRef(null)

  const receiveTopicDomainRef = useRef(null)
  const receiveServiceDomainRef = useRef(null)
  const receiveActionDomainRef = useRef(null)

  const receive = useInterfaceReceiveController({
    availableTopics,
    onActionDomainChange: (id) => actionDomainSelectRef.current?.(id, false),
    onActionSelectionChange: (key) => actionSelectRef.current?.(key),
    onMessageDomainChange: (id) => topicDomainSelectRef.current?.(id, false),
    onMessageSelectionChange: (key) => topicMessageSelectRef.current?.(key),
    onServiceDomainChange: (id) => serviceDomainSelectRef.current?.(id, false),
    onServiceSelectionChange: (key) => serviceSelectRef.current?.(key),
    onTopicSelectionChange: (topic) => topicGraphSelectRef.current?.(topic),
    setAvailableTopics,
    setBusy,
    setFeedback,
  })
  const topic = useTopicExecutionController({
    availableTopics,
    onDomainChange: (id) => receiveTopicDomainRef.current?.(id, false),
    onGraphTopicSelectionChange: receive.selectTopicFromExecution,
    onMessageSelectionChange: receive.selectMessageFromExecution,
    onStateChanged,
    setFeedback,
  })
  const service = useServiceExecutionController({
    onDomainChange: (id) => receiveServiceDomainRef.current?.(id, false),
    onSelectionChange: receive.selectServiceFromExecution,
    onStateChanged,
  })
  const action = useActionExecutionController({
    onDomainChange: (id) => receiveActionDomainRef.current?.(id, false),
    onSelectionChange: receive.selectActionFromExecution,
    onStateChanged,
  })

  topicMessageSelectRef.current = topic.select
  topicGraphSelectRef.current = topic.selectGraphTopicFromReceive
  topicDomainSelectRef.current = topic.selectDomain
  serviceSelectRef.current = service.select
  serviceDomainSelectRef.current = service.selectDomain
  actionSelectRef.current = action.select
  actionDomainSelectRef.current = action.selectDomain

  receiveTopicDomainRef.current = receive.selectTopicDomain
  receiveServiceDomainRef.current = receive.selectServiceDomain
  receiveActionDomainRef.current = receive.selectActionDomain

  return {
    action,
    availableTopics,
    receive,
    service,
    topic,
  }
}
