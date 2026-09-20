/*
 * Показ сповіщень, коли застосунок закритий.
 *
 * Цей файл підмішується до службового робітника, якого збирає Workbox
 * (див. `workbox.importScripts` у vite.config.ts), а не замінює його —
 * офлайн-робота й автооновлення лишаються недоторканими.
 *
 * Сюди приходить те, що розіслав сервер; сам застосунок у цей момент може
 * бути вивантажений з пам'яті, тож усе потрібне приходить у повідомленні.
 */

/** Шляхи рахуємо від області дії робітника — вона різна в dev і на сайті */
function appUrl(path) {
  return new URL(path, self.registration.scope).href
}

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { body: event.data ? event.data.text() : '' }
  }

  const title = payload.title || 'Worship Hub'
  const options = {
    body: payload.body || '',
    icon: appUrl('icon-192.png'),
    badge: appUrl('icon-192.png'),
    // Однакова мітка замінює попереднє сповіщення, а не множить їх
    tag: payload.tag || 'worship-hub',
    data: { url: payload.url ? appUrl(payload.url) : self.registration.scope },
    // На телефоні під час служіння вібрація помітніша за звук
    vibrate: [90, 50, 90],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || self.registration.scope

  event.waitUntil(
    (async () => {
      const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      // Застосунок уже відкритий — краще підняти його, ніж плодити вікна
      for (const client of open) {
        if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    })(),
  )
})
