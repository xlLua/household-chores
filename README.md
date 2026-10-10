# Atelier

A shared household chore list for one house, as an installable PWA — one URL that
works on iPhone and Android with no app store.

Chores sit in a **shared pool** with due dates. Whoever does one ticks it off, and a
monthly points tally keeps the split visible.

---

## 0. Install npm

Node is already here; on Arch/CachyOS npm ships separately and Node 26 no longer
bundles `corepack`:

```sh
sudo pacman -S npm
```

Then:

```sh
npm install
```

## 1. Supabase

1. Create a project at [supabase.com](https://supabase.com) (free tier is plenty for
   a household).
2. **SQL Editor → New query** → paste all of [`schema.sql`](./schema.sql) → Run.
   It creates three tables, the access policies, and adds the tables to the realtime
   publication. It is safe to re-run.
3. **Project Settings → API** → copy the *Project URL* and the *anon public* key.

## 2. Google sign-in

This uses Google Identity Services and `signInWithIdToken`, which returns the ID
token in-page. That matters: a full-page OAuth redirect is the fragile path inside an
installed iOS PWA — it can break out of standalone mode and lose the session on the
way back.

**Google Cloud Console → APIs & Services → Credentials → Create credentials → OAuth
client ID → Web application:**

| Field | Value |
|---|---|
| Authorized **JavaScript origins** | `http://localhost:5173` and `https://<your-app>.vercel.app` |
| Authorized **redirect URIs** | `https://<project-ref>.supabase.co/auth/v1/callback` |

The redirect URI is only needed by the `signInWithOAuth` fallback (used if Google's
script fails to load). The primary flow needs the origins alone.

**Supabase → Authentication → Providers → Google:**

- Enable it, paste the Client ID and Client Secret.
- Add the same Client ID under **Authorized Client IDs** — without this,
  `signInWithIdToken` rejects the token.

**Supabase → Authentication → URL Configuration:** set *Site URL* to your Vercel URL
and add both it and `http://localhost:5173` to *Redirect URLs*.

## 3. Environment

```sh
cp .env.example .env.local
```

Fill in `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_CLIENT_ID`. The
app shows a setup screen naming any that are missing.

## 4. Run

```sh
npm run dev        # http://localhost:5173 (also on your LAN IP, for phone testing)
npm run build      # typecheck + production build
npm run preview    # serve the build, for Lighthouse
```

## 5. Deploy

```sh
npx vercel         # link the project, then `npx vercel --prod`
```

Add the three `VITE_*` variables in **Vercel → Settings → Environment Variables**, then
redeploy. `vercel.json` already rewrites client routes to `index.html`, so refreshing
on `/scores` doesn't 404.

## 6. Get it onto the phones

- **Android/Chrome:** menu → *Install app*.
- **iPhone/Safari:** Share → *Add to Home Screen*. iOS never fires
  `beforeinstallprompt`, so the Settings tab shows these instructions in-app.

Worth doing early: install prompts, icon masking and safe-area behaviour are the
parts most likely to surprise you.

---

## How it works

**No cron, no server.** Recurrence lives on the chore definition; occurrences are
materialised into `chore_instances` by a TypeScript generator
(`src/lib/recurrence.ts`) that runs on app open and after each completion. A
`unique (chore_id, due_date)` constraint makes it idempotent, so it just backfills
whatever is missing. If nobody opens the app for a week, the next open catches up.

**Two kinds of repeat.** `calendar` means every Monday whether or not it got done
(trash). `completion` means ~N days after someone last did it (vacuuming).

**Claim races are handled in the write.** Completing a chore is an update guarded by
`.eq('status', 'open')`. If two roommates tap at the same moment, exactly one gets
the points and the other sees "Someone already got that one."

**Points are derived**, never stored as a counter — a counter drifts the first time
someone undoes a completion.

## Access control

Only the household can use the app. `schema.sql` defines `is_household_member()`,
which checks the signed-in email (from the Supabase JWT, set from Google's verified
address) against a fixed list, and every table's RLS policy requires it. Any other
Google account can complete sign-in but sees nothing and can change nothing; the app
shows a "Geen toegang" screen for them.

To add or remove someone, edit the array in `is_household_member()` in `schema.sql`
and run that `create or replace function` statement in the SQL editor.

RLS stays on regardless because the anon key ships inside the frontend bundle; with
it off, anyone who found the URL could read and delete the chore list.

## Push notifications

Every morning at 07:00 UTC (09:00 summer / 08:00 winter in NL) Vercel Cron calls
`api/notify-overdue.ts`. If any chore is overdue, the two roommates with the fewest
points this month each get one notification listing what's overdue. `push_log`
stops a duplicate cron run from notifying twice in a day; subscriptions that come
back 404/410 are deleted.

Each person turns it on per phone in **Instellingen → Meldingen**, which stores the
subscription in `push_subscriptions`.

Setup, once:
1. Run the "Push notifications" section at the bottom of `schema.sql`.
2. In Vercel, set `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API).
   The VAPID keys, `VAPID_SUBJECT` and `CRON_SECRET` are already set; see
   `.env.example` for the full list. Regenerating the VAPID keys invalidates every
   existing subscription, so everyone would have to turn notifications on again.

Test it by hand: `curl -H "Authorization: Bearer $CRON_SECRET" <url>/api/notify-overdue`
returns JSON with who was picked and how many pushes went out.

**iOS caveat:** web push only works once the PWA has been added to the home screen
(iOS 16.4+), and the permission prompt must come from a real tap.

## Design notes

Whimsical cottagecore by way of *Witch Hat Atelier* — where magic is **drawn**, which
is why completing a chore inks a sigil onto the card rather than just flipping a
checkbox.

- `src/styles/theme.css` — the palette as tokens, day and night. Every colour was
  checked for WCAG AA against the ground it sits on. The mid-tones (sage, periwinkle,
  rose, gold) are for strokes and fills; text uses the `-deep` variants.
- `--chart-bar` is deliberately *not* the UI sage: sage has a chroma of 0.054 and
  reads as grey once it's a data mark. The leaderboard hue is re-stepped per mode and
  validated against its own surface.
- The leaderboard bars are all one hue. Colouring the leader's bar gold would encode
  rank in colour and repaint the rows whenever the month changes — first place is
  marked with a laurel glyph and a gold numeral instead.
- Ornament sits on container edges and in empty states, never behind text.
