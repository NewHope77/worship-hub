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
 * Нагадування додати застосунок на домашній екран.
 * Сенс усієї затії — щоб пісні відкривались як застосунок, без адресного
 * рядка згори; але зробити це може лише сам користувач, зі свого телефона.
 */
export default function InstallHint() {
  const { t } = useStore()
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null)
  const [hidden, setHidden] = useState(
    () => isInstalled() || localStorage.getItem(DISMISSED) === '1',
  )

  useEffect(() => {
    // Chrome дає цю подію, коли застосунок можна встановити одним дотиком
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setPrompt(e as InstallPrompt)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    const onInstalled = () => setHidden(true)
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
    if (!prompt) return
    await prompt.prompt()
    const choice = await prompt.userChoice
    if (choice.outcome === 'accepted') setHidden(true)
  }

  return (
    <div className="no-print mx-3 mb-3 rounded-3xl glass px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none mt-0.5">📲</span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm">{t('install.title')}</div>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed mt-1">
            {prompt
              ? t('install.oneTap')
              : isIos()
                ? t('install.ios')
                : t('install.android')}
          </p>

          <div className="flex gap-2 mt-2.5">
            {prompt && (
              <Button variant="primary" className="!py-2 !px-4 text-sm" onClick={install}>
                {t('install.button')}
              </Button>
            )}
            <button onClick={dismiss}
              className="text-xs text-[var(--text-faint)] hover:text-[var(--text)] px-1">
              {t('install.later')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
