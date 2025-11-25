# Task Manager Auth UI

A lightweight Vite + React implementation of the authentication surfaces (login & registration) inspired by the provided design reference. The layout pairs a gradient navigation rail with a spacious form canvas to match the existing dashboard aesthetic.

## Quick start

```bash
cd frontend
npm install
npm run dev
```

Visit `http://127.0.0.1:5173/login` for the sign-in page or `/register` for the new account screen. The submit handlers now call the FastAPI backend directly, so make sure the API is running (default: `http://localhost:8000`). Override the API origin via a `.env` entry such as `VITE_API_BASE_URL="https://api.example.com"` if needed.

## Production build

```bash
cd frontend
npm run build
npm run preview
```

This produces static assets under `dist/` that can be hosted behind whichever reverse proxy serves the FastAPI app.
