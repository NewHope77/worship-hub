import type { ReactNode } from 'react'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor,
  useSensor, useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent, DraggableAttributes } from '@dnd-kit/core'
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities'
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers'
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

/** Обгортка для вертикального списку, який можна перетягувати */
export function SortableList<T extends { key: string }>({ items, onReorder, children }: {
  items: T[]
  onReorder(next: T[]): void
  children: ReactNode
}) {
  const sensors = useSensors(
    // Затримка, щоб перетягування не заважало прокрутці пальцем
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = items.findIndex((i) => i.key === active.id)
    const to = items.findIndex((i) => i.key === over.id)
    if (from === -1 || to === -1) return
    onReorder(arrayMove(items, from, to))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={handleEnd}
    >
      <SortableContext items={items.map((i) => i.key)} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  )
}

export interface DragHandleProps {
  attributes: DraggableAttributes
  listeners: SyntheticListenerMap | undefined
}

export function SortableRow({ id, children }: {
  id: string
  children: (handle: DragHandleProps) => ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'relative z-20 opacity-90 scale-[1.02] shadow-2xl' : 'relative'}
    >
      {children({ attributes, listeners })}
    </div>
  )
}

export function DragHandle({ attributes, listeners }: DragHandleProps) {
  return (
    <button
      {...attributes}
      {...listeners}
      aria-label="Перетягнути"
      className="shrink-0 w-9 h-9 grid place-items-center rounded-lg text-[var(--text-faint)]
                 hover:text-[var(--text)] hover:bg-[var(--surface-hover)] cursor-grab active:cursor-grabbing touch-none"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="9" cy="6" r="1.7" /><circle cx="15" cy="6" r="1.7" />
        <circle cx="9" cy="12" r="1.7" /><circle cx="15" cy="12" r="1.7" />
        <circle cx="9" cy="18" r="1.7" /><circle cx="15" cy="18" r="1.7" />
      </svg>
    </button>
  )
}
