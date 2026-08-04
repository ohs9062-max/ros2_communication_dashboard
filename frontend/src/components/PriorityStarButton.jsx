export function PriorityStarButton({ item, name, onToggle, pending = false }) {
  const selected = item?.user_primary === true
  return (
    <button
      aria-label={`${name} 사용자 주요 ${selected ? '해제' : '등록'}`}
      aria-pressed={selected}
      className={selected ? 'priority-star selected' : 'priority-star'}
      disabled={pending}
      onClick={(event) => {
        event.stopPropagation()
        onToggle(item)
      }}
      title={selected ? '사용자 주요 지정 해제' : '사용자 주요 지정'}
      type="button"
    >
      {selected ? '★' : '☆'}
    </button>
  )
}
