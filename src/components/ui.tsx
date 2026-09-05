import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { Member } from '../types'
import { INSTRUMENTS } from '../types'

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
  return (
    <span className="text-[var(--text-muted)] text-xs">
      {member.instruments
        .map((id) => INSTRUMENTS.find((i) => i.id === id))
        .filter(Boolean)
        .map((i) => `${i!.emoji} ${i!.name}`)
        .join(' · ')}
    </span>
  )
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger' | 'chip'
  active?: boolean
}

export function Button({ variant = 'ghost', active, className = '', ...rest }: BtnProps) {
  const base = 'inline-flex items-center justify-center gap-1.5 font-medium transition select-none active:scale-[0.97] disabled:opacity-40'
  const styles = {
    primary: 'rounded-xl px-4 py-2.5 bg-amber-500 text-slate-950 hover:bg-amber-400',
    ghost: 'rounded-xl px-3 py-2 bg-[var(--surface-3)] hover:bg-[var(--surface-hover)] text-[var(--text)] border border-[var(--line)]',
    danger: 'rounded-xl px-3 py-2 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 border border-rose-500/30',
    chip: `rounded-lg px-3 py-1.5 text-sm border ${
      active ? 'bg-amber-500 text-slate-950 border-amber-400 font-semibold'
             : 'bg-[var(--surface-2)] text-[var(--text)] border-[var(--line)] hover:bg-[var(--surface-hover)]'}`,
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
    <header className="no-print sticky top-0 z-30 bg-[var(--bg)]/85 backdrop-blur-xl border-b border-[var(--line)] pt-safe">
      <div className="flex items-center gap-2 px-3 h-14">
        {left}
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold truncate leading-tight">{title}</h1>
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
  'w-full rounded-xl bg-[var(--surface-2)] border border-[var(--line)] px-3 py-2.5 text-[var(--text)] ' +
  'placeholder:text-[var(--text-faint)] outline-none focus:border-amber-500/60 focus:bg-[var(--surface-hover)] transition'
