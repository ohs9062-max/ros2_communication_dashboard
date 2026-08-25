import { useState } from 'react'

import { useActionExecutionController } from './useActionExecutionController.js'
import { useInterfaceReceiveController } from './useInterfaceReceiveController.js'
import { useServiceExecutionController } from './useServiceExecutionController.js'
import { useTopicExecutionController } from './useTopicExecutionController.js'

export function useInterfaceExecutionSuite({ onStateChanged, setBusy, setFeedback }) {
  const [availableTopics, setAvailableTopics] = useState([])

  const topic = useTopicExecutionController({
    availableTopics,
    onStateChanged,
    setFeedback,
  })
  const service = useServiceExecutionController({ onStateChanged })
  const action = useActionExecutionController({ onStateChanged })
  const receive = useInterfaceReceiveController({
    availableTopics,
    setAvailableTopics,
    setBusy,
    setFeedback,
  })

  return {
    action,
    availableTopics,
    receive,
    service,
    topic,
  }
}
