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

// SPA fallback: any navigation serves the cached index.html -- except the
// static legal pages, which must load as themselves.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/^\/privacy/, /^\/terms/],
  }),
)

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
// Push: the daily overdue reminder from api/notify-overdue.ts.
//
// iOS only delivers web push once the app is ADDED TO THE HOME SCREEN
// (iOS 16.4+), and the permission prompt must come from a real tap -- both
// handled in Instellingen (src/lib/push.ts).
// ---------------------------------------------------------------------------

self.addEventListener('push', (event) => {
  const payload = (event.data?.json() ?? {}) as { title?: string; body?: string; url?: string }
  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'Onder één Hoedje', {
      body: payload.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: payload.url ?? '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data?.url as string) ?? '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => 'focus' in c) as WindowClient | undefined
      return open ? open.focus() : self.clients.openWindow(url)
    }),
  )
})
