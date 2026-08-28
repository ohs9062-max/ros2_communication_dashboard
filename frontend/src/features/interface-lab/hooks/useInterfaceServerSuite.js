import { useActionServerController } from './useActionServerController.js'
import { useServiceServerController } from './useServiceServerController.js'

export function useInterfaceServerSuite({ onStateChanged, setFeedback }) {
  const serviceServer = useServiceServerController({
    onStateChanged,
    setFeedback,
  })
  const actionServer = useActionServerController({
    onStateChanged,
    setFeedback,
  })

  return {
    actionServer,
    serviceServer,
  }
}
