# ACC Empathy Workshop

A bilingual (EN / 繁中) workshop facilitation tool with synced participant (phone) and facilitator (projected) views, built from the design Claude Code generated in `claude.ai/design`.

## Stack

- Vite + React 18
- Tailwind CSS 3
- lucide-react icons
- React Router (`/` app, `/preview` design canvas)
- Storage backends (chosen at runtime by `src/main.jsx`):
  - **Supabase** (Postgres + Realtime) when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set — used for production cross-device sync between phones and the projector.
  - **localStorage + BroadcastChannel** otherwise — same-tab/same-device sync only, fine for local development and the `/preview` design demo.

## Getting started (local, no backend)

```bash
npm install
npm run dev
```

- <http://localhost:5173/> — live workshop app
- <http://localhost:5173/preview> — hi-fi design canvas with iPhone + browser frames

The fallback shim handles same-device sync, so multiple tabs on your laptop will stay in sync. To exercise true cross-device sync (e.g., your laptop and your phone on the same Wi-Fi), set up Supabase below.

## Wiring up Supabase (cross-device sync)

You'll do this once before the real workshop.

### 1. Create a Supabase project

1. Go to <https://supabase.com>, create a free project (any region near you).
2. Wait for the project to provision (~2 minutes).

### 2. Run the schema

1. In the Supabase dashboard, open **SQL Editor → New query**.
2. Paste the contents of [`supabase/schema.sql`](supabase/schema.sql) and run it.

This creates a `public.acc_storage` table (room, key, value), enables row-level security with public read/write policies, and registers the table for realtime change events.

### 3. Copy your project credentials

In the Supabase dashboard go to **Project Settings → API** and copy:

- **Project URL** → `VITE_SUPABASE_URL`
- **anon / public key** → `VITE_SUPABASE_ANON_KEY`

### 4. Configure the app

```bash
cp .env.example .env.local
# edit .env.local and paste in the values
npm run dev
```

The browser console should now show a Supabase realtime channel connection, and the app's storage routes through the Postgres table. Open the app on your phone (use your laptop's LAN IP, e.g. `http://192.168.1.42:5173/`) — submitting a sticky on the phone updates the projector tab in <1s.

### 5. (Optional) Use rooms to keep workshops separate

The shim reads `?room=<name>` from the URL. So `/?room=acc-2026-04` is a different storage namespace from `/?room=staging`. Useful for dry runs without polluting your real workshop data.

To wipe a room before the real event:

```sql
select public.acc_clear_room('acc-2026-04');
```

## Layout

```
src/
├── App.jsx                  ← unchanged design artifact (paste-ready into Claude)
├── main.jsx                 ← installs Supabase or localStorage shim, mounts routes
├── index.css                ← Tailwind entry + paper-tone base styles
├── lib/
│   ├── storage-shim.js      ← localStorage + BroadcastChannel fallback
│   └── supabase-shim.js     ← Supabase Postgres + Realtime backend
└── preview/
    ├── IOSFrame.jsx         ← iOS 26 device frame (ported from design)
    ├── BrowserFrame.jsx     ← macOS Chrome frame (ported from design)
    └── Preview.jsx          ← canvas at /preview with both frames live-synced
supabase/
└── schema.sql               ← one-shot SQL setup
```

## Deploying

### Option A: Cloudflare Pages (recommended)

```bash
npm run build
npx wrangler pages deploy dist --project-name acc-workshop --branch main
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Pages project's environment variables, then redeploy.

### Option B: Claude artifact (no backend)

`src/App.jsx` is a single-file React component that targets Claude artifacts' real `window.storage`. To deploy as an artifact, paste the contents of `src/App.jsx` into a new Claude artifact at <https://claude.ai>. The Supabase shim is only used outside Claude.

## Day-of-workshop checklist

- [ ] Run `select public.acc_clear_room('<your-room>');` in the Supabase SQL editor 30 minutes before to clear test data.
- [ ] Open the facilitator view on the projector laptop, confirm the realtime indicator is connected.
- [ ] Open the participant view on a personal phone, submit one test sticky, confirm it lands on the projector in <2s.
- [ ] Show the QR code from the projector (Settings → QR) — confirm it points to the participant URL with the right `?room=` value.
