import { useState } from 'react'
import type { Setlist, Song } from './types'
import { useStore } from './store'
import Login from './screens/Login'
import SongList from './screens/SongList'
import SongView from './screens/SongView'
import SongEditor from './screens/SongEditor'
import Profile from './screens/Profile'
import { SetlistList, SetlistView } from './screens/Setlists'

type Tab = 'songs' | 'setlists' | 'me'

type Route =
  | { name: 'tabs' }
  | { name: 'song'; songId: string; setlistTranspose: number | null }
  | { name: 'editSong'; songId: string | null }
  | { name: 'setlist'; setlistId: string }

const TABS: { id: Tab; labelKey: 'nav.songs' | 'nav.setlists' | 'nav.me'; icon: string }[] = [
  { id: 'songs', labelKey: 'nav.songs', icon: '🎼' },
  { id: 'setlists', labelKey: 'nav.setlists', icon: '📋' },
  { id: 'me', labelKey: 'nav.me', icon: '👤' },
]

export default function App() {
  const { me, ready, data, t } = useStore()
  const [tab, setTab] = useState<Tab>('songs')
  const [route, setRoute] = useState<Route>({ name: 'tabs' })

  if (!ready) {
    return <div className="min-h-full grid place-items-center text-[var(--text-faint)]">завантаження…</div>
  }
  if (!me) return <Login />

  const song = route.name === 'song' || route.name === 'editSong'
    ? data.songs.find((s) => s.id === route.songId) ?? null
    : null
  const setlist: Setlist | null = route.name === 'setlist'
    ? data.setlists.find((s) => s.id === route.setlistId) ?? null
    : null

  const back = () => setRoute({ name: 'tabs' })

  if (route.name === 'song' && song) {
    return (
      <SongView
        song={song}
        setlistTranspose={route.setlistTranspose}
        onBack={back}
        onEdit={() => setRoute({ name: 'editSong', songId: song.id })}
      />
    )
  }

  if (route.name === 'editSong') {
    return <SongEditor song={song} onDone={back} />
  }

  if (route.name === 'setlist' && setlist) {
    return (
      <SetlistView
        setlist={setlist}
        onBack={back}
        onOpenSong={(s: Song, transpose: number) =>
          setRoute({ name: 'song', songId: s.id, setlistTranspose: transpose })}
      />
    )
  }

  return (
    <div className="min-h-full flex flex-col">
      <div className="flex-1 pb-16">
        {tab === 'songs' && (
          <SongList
            onOpen={(s) => setRoute({ name: 'song', songId: s.id, setlistTranspose: null })}
            onNew={() => setRoute({ name: 'editSong', songId: null })}
            onEdit={(s) => setRoute({ name: 'editSong', songId: s.id })}
          />
        )}
        {tab === 'setlists' && (
          <SetlistList onOpen={(sl) => setRoute({ name: 'setlist', setlistId: sl.id })} />
        )}
        {tab === 'me' && <Profile />}
      </div>

      <nav className="no-print fixed bottom-0 inset-x-0 z-40 bg-[var(--bg)]/92 backdrop-blur-xl border-t border-[var(--line)] pb-safe">
        <div className="flex max-w-lg mx-auto">
          {TABS.map((item) => (
            <button key={item.id} onClick={() => setTab(item.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition active:scale-95 ${
                tab === item.id ? 'text-[var(--accent)]' : 'text-[var(--text-faint)] hover:text-[var(--text)]'}`}>
              <span className="text-lg leading-none">{item.icon}</span>
              <span className="text-[11px] font-medium">{t(item.labelKey)}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
