import { useCallback, useMemo, useState } from 'react'
import { updateUserPriority } from '../api/rosApi.js'

export function useUserPriority({ items, kind, refresh, nameOf }) {
  const [overrides, setOverrides] = useState({})
  const [pending, setPending] = useState({})
  const [error, setError] = useState(null)

  const decoratedItems = useMemo(
    () => items.map((item) => {
      const name = nameOf(item)
      if (!Object.prototype.hasOwnProperty.call(overrides, name)) {
        return item
      }
      const userPrimary = overrides[name]
      return {
        ...item,
        user_primary: userPrimary,
        is_primary: item.system_primary === true || userPrimary,
      }
    }),
    [items, nameOf, overrides],
  )

  const toggleUserPriority = useCallback(async (item) => {
    const name = nameOf(item)
    if (!name || pending[name]) {
      return
    }
    const current = Object.prototype.hasOwnProperty.call(overrides, name)
      ? overrides[name]
      : item.user_primary === true
    const next = !current
    setError(null)
    setPending((value) => ({ ...value, [name]: true }))
    setOverrides((value) => ({ ...value, [name]: next }))
    try {
      await updateUserPriority(kind, name, next)
      await refresh?.()
    } catch (requestError) {
      setOverrides((value) => {
        const nextValue = { ...value }
        delete nextValue[name]
        return nextValue
      })
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Failed to save the user priority setting.',
      )
    } finally {
      setPending((value) => {
        const nextValue = { ...value }
        delete nextValue[name]
        return nextValue
      })
    }
  }, [kind, nameOf, overrides, pending, refresh])

  const isPriorityPending = useCallback(
    (name) => pending[name] === true,
    [pending],
  )

  return {
    items: decoratedItems,
    priorityError: error,
    toggleUserPriority,
    isPriorityPending,
  }
}
