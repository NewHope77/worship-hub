import { useStore } from '../store'
import { Avatar, InstrumentTags, memberName } from '../components/ui'
import InstallHint from '../components/InstallHint'
import { LANGS } from '../i18n'

export default function Login() {
  const { data, signIn, t, prefs, setPrefs } = useStore()

  return (
    <div className="min-h-full flex flex-col justify-center px-6 py-12 max-w-md mx-auto w-full">
      <div className="mb-10 text-center">
        <div className="text-5xl mb-3">🎵</div>
        <h1 className="text-2xl font-bold tracking-tight">Worship Hub</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1.5">{t('login.title')}</p>
      </div>

      <div className="space-y-2">
        {data.members.map((m) => (
          <button
            key={m.id}
            onClick={() => signIn(m.id)}
            className="glass w-full flex items-center gap-3 p-4 rounded-3xl active:scale-[0.98] transition text-left"
          >
            <Avatar member={m} size={44} />
            <div className="min-w-0 flex-1">
              <div className="font-semibold flex items-center gap-1.5">
                {memberName(m, t)}
                {m.isLeader && <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] bg-amber-400/15 px-1.5 py-0.5 rounded">{t('login.leader')}</span>}
              </div>
              <InstrumentTags member={m} />
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" className="text-[var(--text-faint)]">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        ))}
      </div>

      {/* Найперший екран — саме тут доречно нагадати встановити застосунок */}
      {/* Мова — тут, бо профілю ще немає, а зайти має бути зрозуміло кожному */}
      <div className="flex gap-2 mt-7">
        {LANGS.map((l) => (
          <button
            key={l.id}
            onClick={() => setPrefs({ lang: l.id })}
            className={`flex-1 rounded-2xl py-2.5 text-sm font-semibold transition active:scale-95 ${
              prefs.lang === l.id
                ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-slate-950 border border-white/25'
                : 'glass text-[var(--text-muted)]'}`}
          >
            {l.flag} {l.label}
          </button>
        ))}
      </div>

      <div className="mt-6 -mx-3">
        <InstallHint />
      </div>

      <p className="text-center text-xs text-[var(--text-faint)] mt-4 leading-relaxed">
        {t('login.hint')}
      </p>
    </div>
  )
}
