# Handover

**Date:** 2026-10-10
**Repo:** https://github.com/xlLua/household-chores (public, `main`)
**Plan:** `~/.claude/plans/piped-baking-widget.md`

Read this first after the restart. The headline: **all the code is written and none of
it has ever been compiled or run.** The restart is to pick up `npm`, which was the
blocker for everything below.

---

## 1. What's finished

All source for the app exists — 44 files, committed and pushed.

| Area | File(s) | State |
|---|---|---|
| Database schema | `schema.sql` | Written, **never applied** to a real project |
| Recurrence engine | `src/lib/recurrence.ts` | Written, algorithm tested (see §4) |
| Data access | `src/lib/chores.ts` | Written, never executed |
| Auth (Google) | `src/lib/auth.tsx` | Written, never executed |
| Realtime board hook | `src/hooks/useBoard.ts` | Written, never executed |
| Screens | `src/routes/{Today,Chores,Leaderboard,Settings}.tsx` | Written, **never rendered** |
| Components | `src/components/*` incl. `Sigil`, `glyphs/` | Written, never rendered |
| Design tokens | `src/styles/theme.css`, `app.css` | Written, never seen in a browser |
| Service worker | `src/sw.ts` | Written, never built |
| Icons | `public/icons/*` | **Generated and visually checked** — the one thing actually verified by eye |
| Build config | `vite.config.ts`, `tsconfig*.json`, `vercel.json` | Written, never run |
| Docs | `README.md` | Setup steps for Supabase + Google Cloud |

## 2. What's in progress, and its exact state

**Nothing is half-edited.** No file is in a broken intermediate state; the working
tree is clean and everything is committed. What's incomplete is *verification*, not
code.

Precise state of the environment:

- `node` v26.4.0 — installed
- `npm` — **NOT INSTALLED.** This is the blocker. Arch/CachyOS ships npm as a separate
  package, and Node 26 no longer bundles `corepack`.
- `node_modules/` — does not exist
- `dist/` — does not exist
- `.env.local` — does not exist (only `.env.example` with placeholders)
- Supabase project — **not created**
- Google Cloud OAuth client — **not created**
- Vercel project — **not created**
- `gh` CLI — installed and authenticated as `xlLua`

So the app cannot start yet for three independent reasons: no dependencies, no
backend, no credentials.

## 3. Decisions, and why

**Shared pool with claim-and-points**, not a rotation. Chosen in planning. Rotation
assigns blame; a pool plus a visible tally lets people do what they have time for
while still making an uneven split obvious.

**One household, no tenancy.** You asked to keep it simple, so there is no
`households` table, no invite codes, no join flow, and no per-household scoping. This
removed roughly half the original schema.

**RLS stays on with one trivial policy per table** (`authenticated`, `using (true)`).
Not scoping — there is one household — but the Supabase anon key ships inside the
frontend bundle, so with policies off anyone who found the URL could read and delete
the chore list. Six lines, no helper functions. Deleting them breaks nothing if you'd
rather. As written, *any* Google account that reaches the URL can sign in; the README
has the one-line `auth.email() in (...)` change to restrict it.

**Google Identity Services + `signInWithIdToken`, not `signInWithOAuth`.** GIS returns
the ID token in-page. A full-page OAuth redirect is the fragile path inside an
installed iOS PWA — it can break out of standalone mode and lose the session coming
back. Consequence: Google Cloud needs *Authorized JavaScript origins*, and Supabase
needs the client ID under *Authorized Client IDs*. The redirect fallback is still
wired, which is why a redirect URI is also listed in the README.

**No cron, no server process.** Recurrence is materialised by a client-side generator
that runs on app open and after each completion, made idempotent by
`unique (chore_id, due_date)`. A household app gets opened daily, so the schedule
self-heals; a week of nobody opening it is backfilled on the next open.

**Occurrences are offsets from `start_date`, not a stepped cursor.** `addMonths`
clamps, so stepping would take a chore due on the 31st to Feb 28 and leave it there
permanently. See §4 — this was a real bug, found and fixed.

**Two recurrence anchors.** `calendar` = every Monday regardless (trash).
`completion` = N days after it was last done (vacuuming). Both are real household
needs and retrofitting the second would mean rewriting every existing chore.

**`injectManifest`, not `generateSW`.** `src/sw.ts` is a real file we own, with `push`
and `notificationclick` handlers written and commented out. This is the only part of
"design for push later" that is expensive to retrofit; the subscriptions table and
reminder column were deliberately *not* built, since those are one-line migrations.

**Leaderboard bars are a single hue.** Colouring the leader's bar gold encodes rank in
colour, so the rows would repaint whenever the month switcher changed someone's
position. First place gets a laurel glyph and a gold numeral instead.

**`--chart-bar` is not the UI sage.** The cottagecore sage has a chroma of 0.054 and
reads as grey once it's a data mark rather than a border. The chart hue is re-stepped
per mode (`#607C2E` light, `#7E9A3C` dark — the dark lightness band is narrower,
L 0.48–0.67) and validated against its own surface.

**Deliberately out of scope:** an offline write queue. The shell caches so the app
opens without signal, but completing a chore needs connectivity.

## 4. Known bugs and test state

### Changed after the first run (2026-10-10)

**One open instance per chore.** The generator used to materialise 14 days ahead,
so a weekly chore showed up two or three times under "Binnenkort". Now every chore,
calendar- or completion-anchored, has exactly one open instance; the next one is
created when the current one is done or skipped. Missed calendar occurrences
collapse into the most recent one instead of piling up. `ensureInstances()` trims
any surplus open rows (left by the old generator, or by two phones racing) down to
the earliest. `fetchBoard()` now loads all open instances regardless of date, since
a monthly chore's next instance can be a month out.

**Undo bug fixed.** `uncompleteInstance()` now takes the instance and deletes the
other open instance of that chore, which completing it had generated.

**UI is in Dutch**, with plain wording (no "ledger"/"atelier" flavour text). Dates use
the `nl` date-fns locale. The app is still named Atelier.

### Added later the same day

- **Push notifications** for overdue chores (README → Push notifications). Needs
  `SUPABASE_SERVICE_ROLE_KEY` in Vercel and the push section of `schema.sql` run.
- **Historie** tab: everything completed in the last 30 days, by day, who and when.
- **Weergave** toggle (Systeem / Licht / Donker), stored per device in localStorage;
  dark tokens are keyed to `data-theme` on `<html>`, set before first paint by an
  inline script in `index.html` that mirrors `src/lib/theme.ts`.
- iOS date input overflow fixed (native appearance removed).

### Fixed earlier, worth knowing about

**Monthly drift.** Stepping a cursor one occurrence at a time made a chore due on the
31st clamp to Feb 28 and then stay on the 28th forever. Now computed as offsets from
`start_date`. Verified: `Jan 31 → Feb 28 → Mar 31 → Apr 30`.

### Test state

`npm test` runs `scripts/recurrence.test.mjs` with `node:test`. It imports the real
`src/lib/recurrence.ts` (Node 26 strips the types), so it tests the shipped
generator, not a port. 18 tests, all passing. `typecheck` and `build` are green.

No component tests and no CI.

### Expected-but-unknown problems

- **Typecheck errors.** `tsc` has never run. I fixed the ones I could find by
  inspection (React namespace refs without imports, a prop type routed through a hook
  return, a missing effect dependency), but a codebase this size never passes its
  first typecheck.
- **Dependency versions.** The ranges in `package.json` were written from memory, not
  resolved against the registry. `@vitejs/plugin-react`, `vite-plugin-pwa` and
  `lucide-react` are the likely troublemakers. `npm install` is the first real check.
- **The PWA install risk is entirely unretired.** The plan said to install on both
  phones *before* building features, precisely because install prompts, icon masking
  and safe-area behaviour are the unknowns. npm blocked that, so features got built
  first and the riskiest unknown now sits at the end of the project.
- **`--chart-track` was not run through the palette validator** — it's a track, not a
  data mark, but it's the one colour in the chart that wasn't checked.
- **Google's sign-in button is Google-styled** and will clash somewhat with the
  parchment aesthetic. Their branding rules want their button rendered as-is, so the
  surrounding frame does the theming. Judge it once you can see it.

## 5. Commands

**There are no local services to restart.** No Docker, no local database, no
background processes. Supabase is hosted, so nothing on this machine needs bringing
back up. The full sequence from a cold boot:

```sh
# 0. the blocker — needs your shell, interactive sudo
sudo pacman -S npm

cd ~/Projects/household-chores     # or ~/Projects/household_app, see note below

# 1. dependencies (first real check on the version ranges)
npm install

# 2. will surface the first typecheck errors
npm run typecheck

# 3. dev server — binds to the LAN too, which is how you reach it from a phone
npm run dev                        # http://localhost:5173

# 4. production build + local preview, for Lighthouse
npm run build
npm run preview

# 5. generator tests
npm test

# 6. deploy
npx vercel                         # then: npx vercel --prod
```

> **Directory name:** the local folder is `household_app` but the GitHub repo is
> `household-chores`. Harmless, just don't let it confuse you.

## 6. Next three steps

### Step 1 — Make it compile

```sh
sudo pacman -S npm && npm install && npm run typecheck
```

Fix whatever `tsc` reports, then `npm run build`. Expect dependency-resolution
failures first and type errors second. **Do not touch anything else until this is
green** — every other piece of work is unverifiable while the code can't compile.

### Step 2 — Stand up the backend and run it locally

Follow `README.md` §1–3, which has the exact fields:

1. Create the Supabase project; paste all of `schema.sql` into the SQL editor and run it.
2. Create a Google Cloud OAuth **Web application** client. Authorized JavaScript
   origins: `http://localhost:5173` (add the Vercel URL in step 3). Redirect URI:
   `https://<project-ref>.supabase.co/auth/v1/callback`.
3. In Supabase → Authentication → Providers → Google: enable, paste the client ID and
   secret, **and add the client ID under Authorized Client IDs** — `signInWithIdToken`
   rejects the token without it.
4. `cp .env.example .env.local` and fill in all three values.
5. `npm run dev`, sign in, add a weekly chore and an `every_n_days` chore, and confirm
   the generator produces the due dates you'd expect.

This is the first time any of this code will actually execute. Budget for it.

### Step 3 — Deploy and get it onto both phones

```sh
npx vercel --prod
```

Add the three `VITE_*` vars in Vercel's settings, add the Vercel URL to both the
Google authorized origins and Supabase's URL configuration, then redeploy.

Then install it on the iPhone (Share → Add to Home Screen) and the Android (menu →
Install app), and check the four things that can only be checked there: it opens
standalone with no browser chrome, the icon isn't letterboxed or clipped, the bottom
bar clears the iPhone home indicator, and the parchment is readable outdoors.

**Do this before building anything else.** It's the risk that's been deferred longest.

Fix the undo bug in §4 once the app is running and you can actually reproduce it.
