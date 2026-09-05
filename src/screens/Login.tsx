import { useStore } from '../store'
import { Avatar, InstrumentTags } from '../components/ui'

export default function Login() {
  const { data, signIn } = useStore()

  return (
    <div className="min-h-full flex flex-col justify-center px-6 py-12 max-w-md mx-auto w-full">
      <div className="mb-10 text-center">
        <div className="text-5xl mb-3">🎵</div>
        <h1 className="text-2xl font-bold tracking-tight">Worship Hub</h1>
        <p className="text-slate-400 text-sm mt-1.5">Обери себе, щоб продовжити</p>
      </div>

      <div className="space-y-2">
        {data.members.map((m) => (
          <button
            key={m.id}
            onClick={() => signIn(m.id)}
            className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white/[0.04] border border-white/10
                       hover:bg-white/[0.09] hover:border-white/20 active:scale-[0.98] transition text-left"
          >
            <Avatar member={m} size={44} />
            <div className="min-w-0 flex-1">
              <div className="font-semibold flex items-center gap-1.5">
                {m.name}
                {m.isLeader && <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-400/15 px-1.5 py-0.5 rounded">лідер</span>}
              </div>
              <InstrumentTags member={m} />
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" className="text-slate-600">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        ))}
      </div>

      <p className="text-center text-xs text-slate-600 mt-8 leading-relaxed">
        Імена й інструменти можна змінити в розділі «Я» → «Учасники».
      </p>
    </div>
  )
}
