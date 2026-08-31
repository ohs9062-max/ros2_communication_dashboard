import { useActionServerController } from './useActionServerController.js'
import { useServiceServerController } from './useServiceServerController.js'
import { useServerListController } from './useServerListController.js'

export function useInterfaceServerSuite({ onStateChanged, setFeedback }) {
  const serviceServer = useServiceServerController({
    onStateChanged,
    setFeedback,
  })
  const actionServer = useActionServerController({
    onStateChanged,
    setFeedback,
  })
  const serverList = useServerListController({
    onStateChanged,
    setFeedback,
  })

  return {
    actionServer,
    serverList,
    serviceServer,
  }
}
