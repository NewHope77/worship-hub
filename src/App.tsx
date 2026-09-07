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
      {/*
        Запас під вкладки: вони стали вищими (скляні картки), плюс на телефонах
        знизу є безпечна зона. Без цього кінець сторінки ховається під ними.
      */}
      <div className="flex-1 pb-[calc(7rem+env(safe-area-inset-bottom,0px))]">
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

      {/* Вкладки — окремі скляні картки, під палець */}
      {/*
        Підкладка під вкладками: самі картки щільні, але між ними є проміжки,
        і крізь них просвічував текст, що прокручується нижче.
      */}
      <nav className="no-print fixed bottom-0 inset-x-0 z-40 px-3 pb-safe
                      bg-gradient-to-t from-[var(--bar)] via-[var(--bar)] to-transparent pt-6">
        <div className="flex gap-2 max-w-lg mx-auto pb-3">
          {TABS.map((item) => (
            <button key={item.id} onClick={() => setTab(item.id)}
              className={`glass-bar flex-1 flex flex-col items-center justify-center gap-0.5 h-16
                rounded-3xl transition active:scale-95 ${
                tab === item.id
                  ? 'text-[var(--accent)] !bg-[var(--glass-strong)]'
                  : 'text-[var(--text-muted)]'}`}>
              <span className="text-xl leading-none">{item.icon}</span>
              <span className="text-[11px] font-semibold">{t(item.labelKey)}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
