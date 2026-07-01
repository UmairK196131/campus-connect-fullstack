# Campus Connect — Next.js + Python Edition

The project is now split into two halves that run side by side:

```
frontend/   ← Next.js (React) — all the UI
backend/    ← Flask — JSON API + Socket.IO server + database
```

## Why two folders?

Next.js renders pages and handles forms/state in the browser. It can't run
Flask-SocketIO or talk to SQLite directly — that stays in Python. The two
talk to each other over HTTP and WebSockets.

## How they connect

- **REST calls** (`/api/login`, `/api/rooms`, etc.) go through a **rewrite proxy**
  configured in `next.config.js`. The browser thinks it's talking to Next.js
  itself, so the Flask session cookie just works — no CORS setup needed.
- **Socket.IO** (real-time chat) connects **directly** from the browser to the
  Flask backend, since WebSocket upgrades don't reliably pass through the
  rewrite proxy. This is configured via `NEXT_PUBLIC_SOCKET_URL`.

## Running it locally

### 1. Start the backend (Terminal 1)

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
python app.py
```

This runs on `http://localhost:5000`.

### 2. Start the frontend (Terminal 2)

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

This runs on `http://localhost:3000` — **open this one in your browser.**

## Deploying

- **Backend** → deploy to Render (same steps as before — Flask + gunicorn +
  the `geventwebsocket` worker). See the earlier deployment instructions.
- **Frontend** → deploy to Vercel (Next.js's native platform — this part
  actually IS suited for Vercel, unlike the old all-in-one Flask app).
  Set these environment variables in Vercel's dashboard:
  - `BACKEND_URL` = your deployed Render backend URL
  - `NEXT_PUBLIC_SOCKET_URL` = same Render backend URL

## What changed from the all-in-one Flask version

| Before | Now |
|---|---|
| Flask renders HTML via Jinja2 templates | Flask returns JSON; Next.js renders all UI |
| `templates/*.html` | `app/*/page.js` (React) |
| `static/style.css` | `app/globals.css` (same theme, copied as-is) |
| `static/chat.js` | Logic ported into React hooks in `app/room/[id]/page.js` |
| Session-based page redirects | Client-side `fetch` + `router.push()` |
| Flask serves everything on one port | Two servers, two ports, talking over HTTP/WebSocket |

Socket.IO event names and payloads are **unchanged** — `join`, `send_message`,
`leave`, `typing`, `stop_typing`, `react`, etc. all work exactly as before.
