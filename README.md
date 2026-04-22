# Team Maker

Real-time team creation & voting app. Pointingpoker-style: a session code is shared with attendees; everyone joins the same URL, enters their name, someone divides the group into teams, and then everyone votes for the best team.

## Stack

- Next.js 14 (App Router) + TypeScript
- Socket.IO for real-time updates (custom Node server)
- Tailwind CSS
- In-memory session store (no database)

## Local development

```bash
npm install
npm run dev
# open http://localhost:3000
```

Open the same URL in a second browser window / incognito / another device on the same network to simulate multiple attendees.

## Deploy to Railway

1. Push this repo to GitHub.
2. On [railway.app](https://railway.app), create a new project → **Deploy from GitHub** and pick this repo.
3. Railway auto-detects Node. Defaults from [railway.json](railway.json):
   - Build: `npm run build`
   - Start: `npm start`
4. Railway assigns a `PORT` env var automatically — the server reads it.
5. Under the service's **Settings → Networking**, click **Generate Domain** to get a public URL.
6. Share `https://<your-domain>/` with attendees.

### Notes

- State is in-memory: a redeploy or crash wipes all active sessions. Fine for one-off events; for persistence swap the store for Redis/Postgres.
- Socket.IO uses WebSocket + long-polling fallback. Railway supports both out of the box.
- Only one Railway service instance should run (default). Multiple replicas would split the in-memory state across instances.

## How it works

| Route | Purpose |
|---|---|
| `/` | Start a new session (generates a 6-char code) or join one |
| `/:sessionId` | The actual session: name entry → attendees & team setup → voting → results |

Each browser persists a `participantId` in `localStorage` keyed by session ID, so a page reload keeps your identity.
