import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { Button } from './ui'

const DISMISSED = 'worship-hub:install-hint-off'

/** Подія Chrome, якою можна викликати справжнє вікно встановлення */
interface InstallPrompt extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** Застосунок уже запущений з домашнього екрана, а не з браузера */
function isInstalled(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone
  return window.matchMedia('(display-mode: standalone)').matches || iosStandalone === true
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

/**
 * Кнопка встановлення на домашній екран.
 *
 * Там, де браузер дозволяє (Chrome на Android), натискання одразу відкриває
 * системне вікно встановлення. Safari такого API не дає жодному сайту, тому
 * на iPhone кнопка показує два кроки, які треба зробити вручну.
 */
export default function InstallHint() {
  const { t } = useStore()
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null)
  const [howTo, setHowTo] = useState(false)
  const [hidden, setHidden] = useState(
    () => isInstalled() || localStorage.getItem(DISMISSED) === '1',
  )

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setPrompt(e as InstallPrompt)
    }
    const onInstalled = () => setHidden(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (hidden) return null

  const dismiss = () => {
    localStorage.setItem(DISMISSED, '1')
    setHidden(true)
  }

  const install = async () => {
    // Системне вікно є не завжди — тоді лишається показати кроки вручну
    if (!prompt) {
      setHowTo(true)
      return
    }
    await prompt.prompt()
    const choice = await prompt.userChoice
    if (choice.outcome === 'accepted') setHidden(true)
  }

  const steps = isIos()
    ? { intro: t('install.iosSteps'), one: t('install.iosStep1'), two: t('install.iosStep2') }
    : { intro: t('install.androidSteps'), one: t('install.androidStep1'), two: t('install.androidStep2') }

  return (
    <>
      <div className="no-print px-3">
        <Button variant="primary" className="w-full !py-4 text-base" onClick={install}>
          {t('install.cta')}
        </Button>
        <button onClick={dismiss}
          className="w-full text-center text-xs text-[var(--text-faint)] hover:text-[var(--text)] mt-2 py-1">
          {t('install.later')}
        </button>
      </div>

      {howTo && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog">
          <button aria-label={t('common.cancel')} onClick={() => setHowTo(false)}
            className="absolute inset-0 bg-[var(--overlay)] backdrop-blur-sm" />
          <div className="relative glass-bar rounded-t-3xl p-5 pb-safe space-y-4">
            <div className="w-10 h-1 rounded-full bg-[var(--line-strong)] mx-auto" />
            <div className="font-semibold text-lg">{t('install.howTitle')}</div>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed">{steps.intro}</p>

            <ol className="space-y-3">
              {[steps.one, steps.two].map((step, i) => (
                <li key={i} className="flex gap-3 items-start">
                  <span className="shrink-0 w-7 h-7 rounded-full bg-[var(--accent)] text-slate-950
                                   grid place-items-center font-bold text-sm">
                    {i + 1}
                  </span>
                  <span className="text-sm leading-relaxed pt-0.5">{step}</span>
                </li>
              ))}
            </ol>

            <Button variant="primary" className="w-full" onClick={() => setHowTo(false)}>
              {t('install.close')}
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
