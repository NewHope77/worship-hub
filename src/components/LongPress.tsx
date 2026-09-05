import { useRef } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'

/**
 * Довге натискання. Скасовується, якщо палець поїхав — інакше жест
 * спрацьовував би під час прокрутки списку.
 */
export function useLongPress(onLongPress: () => void, ms = 450) {
  const timer = useRef<number | null>(null)
  const startedAt = useRef<{ x: number; y: number } | null>(null)
  const fired = useRef(false)

  const clear = () => {
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
    startedAt.current = null
  }

  const handlers = {
    onPointerDown(e: ReactPointerEvent) {
      fired.current = false
      startedAt.current = { x: e.clientX, y: e.clientY }
      timer.current = window.setTimeout(() => {
        fired.current = true
        navigator.vibrate?.(12)
        onLongPress()
      }, ms)
    },
    onPointerMove(e: ReactPointerEvent) {
      const start = startedAt.current
      if (!start) return
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) clear()
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
    // Щоб замість нашого меню не вискакувало системне
    onContextMenu(e: ReactMouseEvent) {
      e.preventDefault()
      if (!fired.current) {
        fired.current = true
        onLongPress()
      }
    },
  }

  /** Клік після довгого натискання ігноруємо */
  const consumedClick = () => fired.current

  return { handlers, consumedClick }
}
