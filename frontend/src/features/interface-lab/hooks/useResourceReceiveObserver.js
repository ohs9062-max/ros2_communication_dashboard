import { useState } from 'react'

export function useResourceReceiveObserver({
  history,
  itemKey,
  items,
  kind,
  load,
  nameField,
  resetHistory,
  selectedKey,
  setFeedback,
  typeField,
}) {
  const [activeKey, setActiveKey] = useState('')
  const [search, setSearch] = useState('')
  const selected = items.find((item) => itemKey(item) === selectedKey)
  const keyword = search.trim().toLowerCase()
  const filteredItems = items.filter((item) => {
    if (!keyword) return true
    return `${item[nameField] ?? item.file_name ?? ''} ${item[typeField] ?? ''}`
      .toLowerCase()
      .includes(keyword)
  })
  const visibleHistory = selected && activeKey === selectedKey
    ? history.filter((event) =>
      event[nameField] === selected[nameField]
      && event[typeField] === selected[typeField]
      && event.domain_id === selected.domain_id)
    : []

  const start = async () => {
    if (!selected) {
      setFeedback({ tone: 'error', text: `Select a ${kind} to receive.` })
      return
    }
    try {
      await resetHistory({
        [nameField]: selected[nameField],
        [typeField]: selected[typeField],
        domain_id: selected.domain_id,
      })
      setActiveKey(selectedKey)
      await load()
      setFeedback({
        tone: 'success',
        text: `${selected[nameField]} ${kind} 수신 관찰을 시작했습니다.`,
      })
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message })
    }
  }

  const stop = async () => {
    if (!activeKey) {
      setFeedback({
        tone: 'warning',
        text: `No active ${kind} receive observer is available.`,
      })
      return
    }
    setActiveKey('')
    setFeedback({ tone: 'warning', text: `Stopped the ${kind} receive observer.` })
  }

  const reset = async (selectedOnly = false) => {
    if (selectedOnly && !selected) {
      setFeedback({ tone: 'error', text: `Select a ${kind} to reset.` })
      return
    }
    try {
      const payload = await resetHistory(selectedOnly ? {
        [nameField]: selected[nameField],
        [typeField]: selected[typeField],
        domain_id: selected.domain_id,
      } : undefined)
      await load()
      setFeedback({
        tone: 'success',
        text: selectedOnly
          ? `${selected[nameField]} 수신 이력 ${payload.data?.cleared ?? 0}개를 리셋했습니다.`
          : `${kind} 수신 이력 ${payload.data?.cleared ?? 0}개를 전체 리셋했습니다.`,
      })
    } catch (error) {
      setFeedback({ tone: 'error', text: error.message })
    }
  }

  return {
    activeKey,
    filteredItems,
    reset,
    search,
    setSearch,
    start,
    stop,
    visibleHistory,
  }
}
