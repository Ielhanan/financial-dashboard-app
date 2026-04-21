# Deployment Design: Vercel + Render

**Date:** 2026-04-21  
**Status:** Approved

## Overview

Deploy the Financial Dashboard as a monorepo: Next.js frontend on Vercel, FastAPI backend on Render. Both services point at the same GitHub repo, each configured to their respective subdirectory.

## Architecture

```
GitHub repo (monorepo)
├── frontend/   → Vercel (Next.js, static + SSR)
└── backend/    → Render (FastAPI, Python Web Service)
```

## Backend — Render

- **Service type:** Web Service (not static site) — required for WebSocket support
- **Root directory:** `backend/`
- **Build command:** `pip install -r requirements.txt`
- **Start command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Python version:** specified via `backend/runtime.txt`
- **File to add:** `render.yaml` at repo root — declarative Render config

### Environment Variables (set in Render dashboard)
| Variable | Value |
|---|---|
| `FINANCIAL_API_KEY` | Your FMP API key |
| `CORS_ORIGINS` | `["https://<your-app>.vercel.app"]` |

## Frontend — Vercel

- **Root directory:** `frontend/`
- **Framework preset:** Next.js (auto-detected)
- **No config file changes needed**

### Environment Variables (set in Vercel dashboard)
| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://<your-api>.onrender.com` |

## Code Changes

### `render.yaml` (new file at repo root)
Declarative Render config specifying the web service, build/start commands, and env var references.

### `backend/runtime.txt` (new file)
Pins the Python version for Render (e.g., `python-3.11.0`).

### No frontend code changes
`BASE_URL.replace(/^http/, "ws")` in `api.ts` already correctly converts `https://` → `wss://` for WebSocket connections.

## Deployment Order

1. Add `render.yaml` and `runtime.txt`, commit and push to GitHub
2. Create Render Web Service, connect repo, set env vars
3. Wait for Render deploy — get the `.onrender.com` URL
4. Create Vercel project, set root to `frontend/`, set `NEXT_PUBLIC_API_URL`
5. Set `CORS_ORIGINS` in Render with the Vercel URL
6. Redeploy Render to pick up the CORS update

## Constraints

- Render free tier spins down after 15 min of inactivity — first request after spin-down has ~30s cold start. Acceptable for now.
- WebSockets work on Render free tier.
- `FINANCIAL_API_KEY` must never be committed to the repo.
