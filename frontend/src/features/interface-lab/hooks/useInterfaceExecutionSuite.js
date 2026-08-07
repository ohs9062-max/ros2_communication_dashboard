import { useState } from 'react'

import { useActionExecutionController } from './useActionExecutionController.js'
import { useInterfaceReceiveController } from './useInterfaceReceiveController.js'
import { useServiceExecutionController } from './useServiceExecutionController.js'
import { useTopicExecutionController } from './useTopicExecutionController.js'

export function useInterfaceExecutionSuite({ onStateChanged, setBusy, setFeedback }) {
  const [availableTopics, setAvailableTopics] = useState([])
  const [selectedReceiveServiceKey, setSelectedReceiveServiceKey] = useState('')
  const [selectedReceiveActionKey, setSelectedReceiveActionKey] = useState('')

  const topic = useTopicExecutionController({
    availableTopics,
    onStateChanged,
    setFeedback,
  })
  const service = useServiceExecutionController({
    onSelectionChange: setSelectedReceiveServiceKey,
    onStateChanged,
  })
  const action = useActionExecutionController({
    onSelectionChange: setSelectedReceiveActionKey,
    onStateChanged,
  })
  const receive = useInterfaceReceiveController({
    actions: action.actions,
    availableTopics,
    replaceActions: action.replace,
    replaceMessages: topic.replace,
    replaceServices: service.replace,
    selectedMessage: topic.selected,
    selectedReceiveActionKey,
    selectedReceiveServiceKey,
    services: service.services,
    setAvailableTopics,
    setBusy,
    setFeedback,
    setSelectedReceiveActionKey,
    setSelectedReceiveServiceKey,
  })

  return {
    action,
    availableTopics,
    receive,
    selectedReceiveActionKey,
    selectedReceiveServiceKey,
    service,
    topic,
  }
}
