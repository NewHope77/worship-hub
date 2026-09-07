import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { readCloudConfig, saveCloudConfig, readLocalData } from '../storage'
import { isGroupCloud, hasGroupCloud, detachCloud, clearCloudConfig } from '../storage/config'
import { createSupabaseAdapter } from '../storage/supabase'
import { TopBar, BackButton, Button, Field, inputClass } from '../components/ui'

type State =
  | { kind: 'idle' }
  | { kind: 'busy'; text: string }
  | { kind: 'error'; text: string }
  | { kind: 'done'; text: string }

/**
 * Підключення спільної бази. Ключі зберігаються на пристрої, а не в коді:
 * застосунок лежить у відкритому репозиторії, і ключ звідти прочитав би будь-хто.
 */
export default function CloudSetup({ onDone }: { onDone(): void }) {
  const existing = readCloudConfig()
  const onGroupCloud = isGroupCloud(existing)
  const [url, setUrl] = useState(existing?.url ?? '')
  const [key, setKey] = useState(existing?.anonKey ?? '')
  const [state, setState] = useState<State>({ kind: 'idle' })
  // Поля потрібні лише тому, хто підключає власну базу замість спільної
  const [showManual, setShowManual] = useState(false)

  const connect = async () => {
    const cleanUrl = url.trim().replace(/\/+$/, '')
    const cleanKey = key.trim()
    if (!cleanUrl || !cleanKey) {
      setState({ kind: 'error', text: 'Заповни обидва поля.' })
      return
    }

    setState({ kind: 'busy', text: 'Перевіряю з’єднання…' })
    try {
      const client = createClient(cleanUrl, cleanKey, { auth: { persistSession: false } })
      const { error } = await client.from('songs').select('id').limit(1)
      if (error) throw new Error(error.message)

      saveCloudConfig({ url: cleanUrl, anonKey: cleanKey })
      setState({ kind: 'done', text: 'Підключено. Перезавантажую…' })
      setTimeout(() => location.reload(), 800)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setState({
        kind: 'error',
        text: /relation|does not exist|schema/i.test(msg)
          ? 'База відповідає, але таблиць у ній немає. Виконай SQL зі схеми у Supabase → SQL Editor.'
          : `Не вдалося підключитись: ${msg}`,
      })
    }
  }

  const upload = async () => {
    const config = readCloudConfig()
    if (!config) return
    setState({ kind: 'busy', text: 'Переношу пісні у спільну базу…' })
    try {
      const local = await readLocalData()
      const cloud = createSupabaseAdapter(config)
      const current = await cloud.load()

      // Додаємо лише те, чого в спільній базі ще немає — нічиї правки не затираємо
      const has = new Set(current.songs.map((s) => s.id))
      const merged = {
        ...current,
        songs: [...current.songs, ...local.songs.filter((s) => !has.has(s.id))],
      }
      const added = merged.songs.length - current.songs.length
      await cloud.save(merged)
      setState({ kind: 'done', text: `Перенесено пісень: ${added}. Перезавантажую…` })
      setTimeout(() => location.reload(), 1200)
    } catch (e) {
      setState({ kind: 'error', text: e instanceof Error ? e.message : String(e) })
    }
  }

  const disconnect = () => {
    if (!confirm('Від’єднатись від спільної бази? Пісні в ній лишаться, а цей пристрій працюватиме сам по собі.')) return
    detachCloud()
    location.reload()
  }

  const rejoin = () => {
    clearCloudConfig()
    location.reload()
  }

  return (
    <div className="min-h-full flex flex-col">
      <TopBar left={<BackButton onClick={onDone} />} title="Спільна база" />

      <div className="flex-1 px-4 py-5 space-y-5">
        {onGroupCloud ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.08] px-4 py-3">
            <div className="font-semibold text-emerald-300">Спільна база групи підключена</div>
            <p className="text-xs text-[var(--text-muted)] mt-1.5 leading-relaxed">
              Нічого налаштовувати не треба: пісні, сети й порядок однакові в усіх,
              хто відкрив цей застосунок. Додав один — бачать решта.
              Тональність, каподастр і свої нотатки лишаються особистими.
            </p>
          </div>
        ) : existing ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.08] px-4 py-3">
            <div className="font-semibold text-emerald-300">Підключено власну базу</div>
            <div className="text-xs text-[var(--text-muted)] mt-1 break-all">{existing.url}</div>
          </div>
        ) : (
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-1)] px-4 py-3">
            <div className="font-semibold mb-1">Працюєш лише на цьому пристрої</div>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Пісні нікуди не йдуть і решта групи їх не бачить.
            </p>
            {hasGroupCloud() && (
              <Button variant="primary" className="w-full mt-3" onClick={rejoin}>
                Повернутись до спільної бази
              </Button>
            )}
          </div>
        )}

        {state.kind === 'error' && (
          <div className="rounded-xl bg-rose-500/12 border border-rose-500/30 px-3 py-2.5 text-xs text-rose-200 leading-relaxed">
            {state.text}
          </div>
        )}
        {(state.kind === 'busy' || state.kind === 'done') && (
          <div className="rounded-xl bg-[var(--surface-2)] border border-[var(--line)] px-3 py-2.5 text-xs text-[var(--accent)]">
            {state.text}
          </div>
        )}

        {existing && (
          <>
            <Button className="w-full" onClick={upload} disabled={state.kind === 'busy'}>
              ⬆️ Перенести пісні з цього пристрою
            </Button>
            <p className="text-[11px] text-[var(--text-faint)] leading-relaxed">
              Додасть у спільну базу лише ті пісні, яких там ще немає. Нічиї правки не зникнуть.
            </p>
          </>
        )}

        <div className="pt-2 border-t border-[var(--line-soft)]" />

        {showManual ? (
          <>
            <Field label="Адреса проєкту" hint="Supabase → Settings → Data API → Project URL">
              <input className={inputClass} value={url} onChange={(e) => setUrl(e.target.value)}
                placeholder="https://xxxxx.supabase.co" autoCapitalize="off" autoCorrect="off" />
            </Field>
            <Field label="Публічний ключ" hint="той самий екран, ключ anon / publishable">
              <textarea className={inputClass + ' font-mono text-xs resize-none'} rows={3}
                value={key} onChange={(e) => setKey(e.target.value)} placeholder="sb_publishable_…" />
            </Field>
            <Button variant="primary" className="w-full" onClick={connect}
              disabled={state.kind === 'busy'}>
              Підключити цю базу
            </Button>
          </>
        ) : (
          <button onClick={() => setShowManual(true)}
            className="text-xs text-[var(--text-faint)] hover:text-[var(--text)]">
            Підключити іншу базу (для іншої групи)
          </button>
        )}

        {existing && (
          <Button variant="danger" className="w-full" onClick={disconnect}>
            Працювати лише на цьому пристрої
          </Button>
        )}
      </div>
    </div>
  )
}
