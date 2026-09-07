import { useRef, useState } from 'react'
import type { InstrumentId, Member } from '../types'
import { INSTRUMENTS, playsInstrument, needsChords } from '../types'
import { LANGS } from '../i18n'
import { useStore } from '../store'
import { newId } from '../chordpro/parse'
import { isCloudConnected } from '../storage'
import { downloadBackup, readBackup, mergeBackup } from '../storage/backup'
import CloudSetup from './CloudSetup'
import { TopBar, BackButton, Button, Avatar, InstrumentTags, Field, inputClass, instrumentKey, memberName } from '../components/ui'

const COLORS = [
  'from-violet-500 to-fuchsia-500',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
  'from-sky-500 to-cyan-500',
  'from-emerald-500 to-teal-500',
  'from-slate-400 to-slate-600',
  'from-indigo-500 to-blue-500',
  'from-lime-500 to-green-500',
]

export default function Profile() {
  const { me, data, prefs, setPrefs, signOut, meId, replaceAll, t } = useStore()
  const [editing, setEditing] = useState<Member | null>(null)
  const [showMembers, setShowMembers] = useState(false)
  const [showCloud, setShowCloud] = useState(false)
  const [backupNote, setBackupNote] = useState('')
  const backupInput = useRef<HTMLInputElement>(null)

  if (!me) return null

  if (showCloud) {
    return <CloudSetup onDone={() => setShowCloud(false)} />
  }

  if (editing) {
    return <MemberEditor member={editing} onDone={() => setEditing(null)} />
  }

  if (showMembers) {
    return (
      <div className="min-h-full flex flex-col">
        <TopBar left={<BackButton onClick={() => setShowMembers(false)} />} title={t('profile.members')}
          right={
            <Button variant="primary" className="!px-3 !py-2"
              onClick={() => setEditing({
                id: newId('m'), name: '', instruments: ['vocal'], isLeader: false,
                color: COLORS[data.members.length % COLORS.length],
              })}>
              {t('member.add')}
            </Button>
          } />
        <div className="flex-1 px-3 py-3 space-y-1.5">
          {data.members.map((m) => (
            <button key={m.id} onClick={() => setEditing(m)}
              className="w-full flex items-center gap-3 p-3 rounded-3xl glass hover:bg-[var(--surface-hover)] text-left">
              <Avatar member={m} size={40} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold flex items-center gap-1.5">
                  {memberName(m, t)}
                  {m.isLeader && <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] bg-amber-400/15 px-1.5 py-0.5 rounded">лідер</span>}
                  {m.id === meId && <span className="text-[10px] text-[var(--text-faint)]">{t('member.you')}</span>}
                </div>
                <InstrumentTags member={m} />
              </div>
              <span className="text-[var(--text-faint)] text-sm">{t('member.change')}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  const primary = INSTRUMENTS.find((i) => i.id === me.instruments[0])

  return (
    <div className="min-h-full flex flex-col">
      <TopBar title={t('profile.title')} />
      <div className="flex-1 px-4 py-5 space-y-6">
        <div className="flex items-center gap-4">
          <Avatar member={me} size={64} />
          <div className="min-w-0">
            <div className="text-xl font-bold truncate">{memberName(me, t)}</div>
            <InstrumentTags member={me} />
          </div>
        </div>

        <div className="space-y-3">
          <div className="font-semibold text-sm text-[var(--text)]">{t('profile.mySettings')}</div>

          {!needsChords(me) ? (
            <Field label={t('profile.showInSongs')}
              hint={t('profile.drummerHint')}>
              <div className="rounded-xl bg-[var(--surface-1)] border border-[var(--line)] px-3 py-2.5 text-sm text-[var(--text-muted)]">
                {t('profile.drumsOnlyText')}
              </div>
            </Field>
          ) : (
          <Field label={t('profile.showDefault')}
            hint={primary ? `${t('profile.instrumentHint')} «${t(instrumentKey(primary.id))}»` : undefined}>
            <div className="flex gap-2">
              <Button variant="chip" active={prefs.viewMode !== 'grid'} className="flex-1"
                disabled={prefs.viewMode === 'text'}
                onClick={() => setPrefs({ viewMode: prefs.viewMode === 'grid' ? 'chords' : 'text' })}>
                {prefs.viewMode !== 'grid' ? '✓ ' : ''}Текст
              </Button>
              <Button variant="chip" active={prefs.viewMode !== 'text'} className="flex-1"
                disabled={prefs.viewMode === 'grid'}
                onClick={() => setPrefs({ viewMode: prefs.viewMode === 'text' ? 'chords' : 'grid' })}>
                {prefs.viewMode !== 'text' ? '✓ ' : ''}Акорди
              </Button>
            </div>
            <div className="text-[11px] text-[var(--text-faint)] mt-1.5">
              {prefs.viewMode === 'chords' ? 'Акорди над словами'
                : prefs.viewMode === 'text' ? 'Тільки слова'
                : 'Тільки акорди — на своїх місцях над складами'}
            </div>
          </Field>
          )}

          <Field label={`${t('profile.textSize')}: ${prefs.fontSize}px`}>
            <input type="range" min={13} max={30} value={prefs.fontSize} className="w-full accent-amber-500"
              onChange={(e) => setPrefs({ fontSize: +e.target.value })} />
          </Field>

          <Field label={t('profile.language')} hint={t('profile.languageHint')}>
            <div className="flex gap-2">
              {LANGS.map((l) => (
                <Button key={l.id} variant="chip" active={prefs.lang === l.id} className="flex-1"
                  onClick={() => setPrefs({ lang: l.id })}>
                  {l.flag} {l.label}
                </Button>
              ))}
            </div>
          </Field>

          <Field label={t('profile.screen')}>
            <div className="flex gap-2">
              <Button variant="chip" active={prefs.theme === 'dark'} className="flex-1"
                onClick={() => setPrefs({ theme: 'dark' })}>
                {t('profile.dark')}
              </Button>
              <Button variant="chip" active={prefs.theme === 'light'} className="flex-1"
                onClick={() => setPrefs({ theme: 'light' })}>
                {t('profile.light')}
              </Button>
            </div>
            <div className="text-[11px] text-[var(--text-faint)] mt-1.5">
              {prefs.theme === 'dark'
                ? 'Темний не сліпить на сцені й у напівтемряві'
                : 'Світлий краще читається при яскравому світлі й на вулиці'}
            </div>
          </Field>

          {playsInstrument(me, 'agtr') && (
            <label className="flex items-center gap-3 py-1 cursor-pointer">
              <input type="checkbox" checked={prefs.showCapo} className="w-4 h-4 accent-amber-500"
                onChange={(e) => setPrefs({ showCapo: e.target.checked })} />
              <span className="text-sm text-[var(--text)]">{t('profile.capoHint')}</span>
            </label>
          )}
        </div>

        <div className="space-y-2 pt-2">
          <div className="text-xs font-medium text-[var(--text-muted)]">{t('profile.transfer')}</div>
          <input ref={backupInput} type="file" accept=".json,application/json" className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              try {
                const incoming = await readBackup(file)
                const { data: merged, added } = mergeBackup(data, incoming)
                replaceAll(merged)
                setBackupNote(added ? `Додано пісень: ${added}` : 'Нових пісень не знайшлось')
              } catch (err) {
                setBackupNote(err instanceof Error ? err.message : String(err))
              }
            }} />
          <Button className="w-full !justify-between"
            onClick={() => { downloadBackup(data); setBackupNote('Файл збережено') }}>
            <span>{t('profile.saveFile')}</span>
            <span className="text-[var(--text-faint)] text-sm">{data.songs.length} пісень</span>
          </Button>
          <Button className="w-full !justify-between" onClick={() => backupInput.current?.click()}>
            <span>{t('profile.loadFile')}</span>
            <span className="text-[var(--text-faint)]">→</span>
          </Button>
          {backupNote && (
            <div className="text-[11px] text-[var(--accent)] px-1">{backupNote}</div>
          )}
          <p className="text-[11px] text-[var(--text-faint)] leading-relaxed px-1">
            Так пісні переносяться на інший телефон або з локальної адреси сюди.
            Наявні пісні не зникають — додається лише те, чого ще немає.
          </p>

          <div className="pt-2 text-xs font-medium text-[var(--text-muted)]">{t('profile.group')}</div>
          <Button className="w-full !justify-between" onClick={() => setShowCloud(true)}>
            <span>{t('profile.cloud')}</span>
            <span className={`text-sm ${isCloudConnected() ? 'text-emerald-400' : 'text-[var(--text-faint)]'}`}>
              {isCloudConnected() ? t('profile.connected') : t('profile.notConnected')}
            </span>
          </Button>
          <Button className="w-full !justify-between" onClick={() => setShowMembers(true)}>
            <span>{t('profile.members')}</span>
            <span className="text-[var(--text-faint)] text-sm">{data.members.length} →</span>
          </Button>
          <Button className="w-full !justify-between" onClick={signOut}>
            <span>{t('profile.signOut')}</span>
            <span className="text-[var(--text-faint)]">→</span>
          </Button>
        </div>

        <div className="text-[11px] text-[var(--text-faint)] leading-relaxed pt-4 border-t border-[var(--line-soft)]">
          {isCloudConnected()
            ? 'Пісні та сети спільні для всієї групи. Тональність, каподастр і свої нотатки лишаються особистими.'
            : 'Пісні зберігаються на цьому пристрої. Підключи спільну базу, щоб їх бачила вся група.'}
        </div>
      </div>
    </div>
  )
}

function MemberEditor({ member, onDone }: { member: Member; onDone(): void }) {
  const { upsertMember, deleteMember, data, meId, signOut, t } = useStore()
  const [draft, setDraft] = useState<Member>(member)
  const exists = data.members.some((m) => m.id === member.id)

  const toggleInstrument = (id: InstrumentId) =>
    setDraft((d) => ({
      ...d,
      instruments: d.instruments.includes(id)
        ? d.instruments.filter((x) => x !== id)
        : [...d.instruments, id],
    }))

  const save = () => {
    upsertMember({ ...draft, name: draft.name.trim() || t('member.noName') })
    onDone()
  }

  const remove = () => {
    if (!confirm(`Видалити ${draft.name}?`)) return
    deleteMember(draft.id)
    if (draft.id === meId) signOut()
    onDone()
  }

  return (
    <div className="min-h-full flex flex-col">
      <TopBar left={<BackButton onClick={onDone} />} title={exists ? t('member.title') : t('member.new')}
        right={<Button variant="primary" onClick={save} className="!px-4 !py-2">Зберегти</Button>} />
      <div className="flex-1 px-4 py-5 space-y-5">
        <div className="flex justify-center"><Avatar member={draft} size={72} /></div>

        <Field label={t('member.name')}>
          <input className={inputClass} value={draft.name} placeholder={t('member.namePlaceholder')}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus={!exists} />
        </Field>

        <Field label={t('member.instruments')} hint={t('member.instrumentsHint')}>
          <div className="flex flex-wrap gap-2">
            {INSTRUMENTS.map((i) => (
              <Button key={i.id} variant="chip" active={draft.instruments.includes(i.id)}
                onClick={() => toggleInstrument(i.id)}>
                {i.emoji} {t(instrumentKey(i.id))}
              </Button>
            ))}
          </div>
        </Field>

        <Field label={t('member.color')}>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button key={c} onClick={() => setDraft({ ...draft, color: c })}
                aria-label={t('member.color')}
                className={`w-9 h-9 rounded-full bg-gradient-to-br ${c} transition
                  ${draft.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0f1115]' : 'opacity-60 hover:opacity-100'}`} />
            ))}
          </div>
        </Field>

        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={draft.isLeader} className="w-4 h-4 accent-amber-500"
            onChange={(e) => setDraft({ ...draft, isLeader: e.target.checked })} />
          <span className="text-sm text-[var(--text)]">{t('member.leader')}</span>
        </label>

        {exists && data.members.length > 1 && (
          <Button variant="danger" className="w-full" onClick={remove}>{t('member.delete')}</Button>
        )}
      </div>
    </div>
  )
}
