import { useCallback } from 'react'

import {
  refreshExecutionCandidates,
  removeWithExecutionRefresh,
} from '../model/executionCandidateRefresh.js'

export function useInterfaceRemovalActions({
  loadActionExecution,
  loadServiceExecution,
  loadTopicExecution,
  removeManualDefinition,
  removePackage,
  removeRegistryEntry,
}) {
  const refreshAfterDelete = useCallback(
    () => refreshExecutionCandidates([
      loadTopicExecution,
      loadServiceExecution,
      loadActionExecution,
    ]),
    [loadActionExecution, loadServiceExecution, loadTopicExecution],
  )

  return {
    handleRemoveManualDefinition: useCallback(
      (item) => removeWithExecutionRefresh(removeManualDefinition, item, refreshAfterDelete),
      [refreshAfterDelete, removeManualDefinition],
    ),
    handleRemovePackage: useCallback(
      (packageName) => removeWithExecutionRefresh(removePackage, packageName, refreshAfterDelete),
      [refreshAfterDelete, removePackage],
    ),
    handleRemoveRegistryEntry: useCallback(
      (item) => removeWithExecutionRefresh(removeRegistryEntry, item, refreshAfterDelete),
      [refreshAfterDelete, removeRegistryEntry],
    ),
  }
}
