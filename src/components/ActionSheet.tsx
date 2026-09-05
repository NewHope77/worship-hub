import type { ReactNode } from 'react'

export interface SheetAction {
  label: string
  icon?: string
  danger?: boolean
  onClick(): void
}

/** Панель дій знизу екрана — зручно дотягтися великим пальцем */
export default function ActionSheet({ title, subtitle, actions, onClose }: {
  title: string
  subtitle?: ReactNode
  actions: SheetAction[]
  onClose(): void
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-label={title}>
      <button
        aria-label="Закрити"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-[fadeIn_.15s_ease-out]"
      />
      <div className="relative bg-[#171a21] border-t border-white/10 rounded-t-3xl p-3 pb-safe
                      shadow-2xl animate-[sheetUp_.2s_ease-out]">
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-3" />
        <div className="px-3 pb-3">
          <div className="font-semibold truncate">{title}</div>
          {subtitle && <div className="text-xs text-slate-500 truncate mt-0.5">{subtitle}</div>}
        </div>
        <div className="space-y-1.5">
          {actions.map((a) => (
            <button
              key={a.label}
              onClick={() => { a.onClick(); onClose() }}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left font-medium
                          transition active:scale-[0.98] ${
                a.danger
                  ? 'bg-rose-500/12 text-rose-300 hover:bg-rose-500/20'
                  : 'bg-white/[0.06] text-slate-200 hover:bg-white/[0.12]'}`}
            >
              {a.icon && <span className="text-lg leading-none">{a.icon}</span>}
              {a.label}
            </button>
          ))}
          <button
            onClick={onClose}
            className="w-full px-4 py-3.5 rounded-2xl bg-white/[0.03] text-slate-400 font-medium
                       hover:bg-white/[0.08] active:scale-[0.98] transition mt-1"
          >
            Скасувати
          </button>
        </div>
      </div>
    </div>
  )
}
