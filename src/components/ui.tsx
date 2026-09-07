import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { InstrumentId, Member } from '../types'
import { INSTRUMENTS } from '../types'
import { useStore } from '../store'
import type { Key } from '../i18n'

/** Ключ перекладу для інструмента — назви живуть у словнику, а не в коді */
export function instrumentKey(id: InstrumentId): Key {
  return `instrument.${id}` as Key
}

export function Avatar({ member, size = 40 }: { member: Member; size?: number }) {
  const initials = member.name.trim().slice(0, 2).toUpperCase()
  return (
    <div
      className={`shrink-0 rounded-full bg-gradient-to-br ${member.color} grid place-items-center font-bold text-white shadow-lg`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials}
    </div>
  )
}

export function InstrumentTags({ member }: { member: Member }) {
  const { t } = useStore()
  return (
    <span className="text-[var(--text-muted)] text-xs">
      {member.instruments
        .map((id) => INSTRUMENTS.find((i) => i.id === id))
        .filter(Boolean)
        .map((i) => `${i!.emoji} ${t(instrumentKey(i!.id))}`)
        .join(' · ')}
    </span>
  )
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger' | 'chip'
  active?: boolean
}

export function Button({ variant = 'ghost', active, className = '', ...rest }: BtnProps) {
  const base = 'inline-flex items-center justify-center gap-1.5 font-semibold transition select-none active:scale-[0.97] disabled:opacity-40'
  const styles = {
    // Головна дія світиться теплим — її видно навіть боковим зором
    primary: 'rounded-2xl px-5 py-3 text-slate-950 border border-white/25 '
      + 'bg-gradient-to-b from-amber-300 to-amber-500 shadow-[0_8px_22px_rgba(255,150,50,0.3)]',
    ghost: 'glass rounded-2xl px-4 py-3 text-[var(--text)]',
    danger: 'rounded-2xl px-4 py-3 bg-rose-500/18 text-rose-300 border border-rose-500/35',
    chip: `rounded-2xl px-4 py-2 text-sm border ${
      active ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-slate-950 border-white/25 font-bold'
             : 'glass text-[var(--text)]'}`,
  }[variant]
  return <button className={`${base} ${styles} ${className}`} {...rest} />
}

export function Screen({ children }: { children: ReactNode }) {
  return <div className="min-h-full flex flex-col">{children}</div>
}

export function TopBar({ title, left, right, subtitle }: {
  title: ReactNode; subtitle?: ReactNode; left?: ReactNode; right?: ReactNode
}) {
  return (
    <header className="no-print sticky top-0 z-30 glass-bar rounded-b-3xl pt-safe !border-t-0 !border-x-0">
      <div className="flex items-center gap-2 px-3 h-16">
        {left}
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-lg truncate leading-tight tracking-tight">{title}</h1>
          {subtitle && <div className="text-xs text-[var(--text-muted)] truncate">{subtitle}</div>}
        </div>
        {right}
      </div>
    </header>
  )
}

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label="Назад"
      className="shrink-0 w-9 h-9 grid place-items-center rounded-full hover:bg-[var(--surface-hover)] active:scale-90 transition text-[var(--text)]">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
  )
}

export function Empty({ icon, title, hint, action }: {
  icon: string; title: string; hint?: string; action?: ReactNode
}) {
  return (
    <div className="flex-1 grid place-items-center px-8 py-20 text-center">
      <div>
        <div className="text-5xl mb-4 opacity-60">{icon}</div>
        <div className="font-semibold text-[var(--text)] mb-1">{title}</div>
        {hint && <div className="text-sm text-[var(--text-faint)] mb-5 max-w-xs mx-auto leading-relaxed">{hint}</div>}
        {action}
      </div>
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-[var(--text-muted)] mb-1.5">{label}</div>
      {children}
      {hint && <div className="text-[11px] text-[var(--text-faint)] mt-1">{hint}</div>}
    </label>
  )
}

export const inputClass =
  'w-full glass rounded-2xl px-4 py-3 text-[var(--text)] ' +
  'placeholder:text-[var(--text-faint)] outline-none focus:border-amber-400/60 transition'
