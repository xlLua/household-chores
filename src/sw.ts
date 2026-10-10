/// <reference lib="webworker" />
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}

// --- app shell -------------------------------------------------------------
// Precached at build time by vite-plugin-pwa, so the app opens with no signal.
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// SPA fallback: any navigation serves the cached index.html.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

// Fonts are self-hosted now, so they arrive in the precache above.

// Deliberately NOT cached: Supabase API calls. A stale chore list that says
// something is still open when a roommate already did it is worse than an
// honest offline banner.

// --- lifecycle (registerType: 'autoUpdate') --------------------------------
self.addEventListener('install', () => {
  self.skipWaiting()
})
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Left behind by the Google Fonts era; nothing reads them any more.
      caches.delete('atelier-font-css'),
      caches.delete('atelier-font-files'),
    ]),
  )
})

// ---------------------------------------------------------------------------
// Push reminders — not enabled in v1.
//
// This worker exists as a real file (strategies: 'injectManifest') precisely so
// turning push on later is additive. The remaining work is then:
//   1. `push_subscriptions` table + a `reminder_lead_minutes` column on chores
//   2. VAPID keys, and a scheduled job that sends to the stored subscriptions
//   3. Uncomment below
//
// iOS caveat worth knowing before promising roommates notifications: web push
// only works once the PWA is ADDED TO THE HOME SCREEN (iOS 16.4+), and the
// permission prompt must be triggered by a real tap.
// ---------------------------------------------------------------------------

// self.addEventListener('push', (event) => {
//   const payload = event.data?.json() ?? {}
//   event.waitUntil(
//     self.registration.showNotification(payload.title ?? 'Onder één Hoedje', {
//       body: payload.body,
//       icon: '/icons/icon-192.png',
//       badge: '/icons/icon-192.png',
//       data: { url: payload.url ?? '/' },
//     }),
//   )
// })
//
// self.addEventListener('notificationclick', (event) => {
//   event.notification.close()
//   const url = (event.notification.data?.url as string) ?? '/'
//   event.waitUntil(
//     self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
//       const open = list.find((c) => 'focus' in c)
//       return open ? open.focus() : self.clients.openWindow(url)
//     }),
//   )
// })
