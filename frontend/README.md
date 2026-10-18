# Cloud Social Platform frontend

React 18 + TypeScript + Vite 5 SPA. The **authoritative project documentation** is the repository root [README.md](../README.md), including setup, API contracts, environment variables and known limitations.

For development with the **Docker gateway running on port 8080**:

```bash
npm ci
cp .env.example .env
npm run dev
```

`VITE_API_BASE_URL=/api` uses `vite.config.ts` to proxy requests to `http://localhost:8080`. For a **standalone** Python gateway running on port 8000, change `VITE_API_BASE_URL` in `frontend/.env` to `http://127.0.0.1:8000` and restart Vite.

Build/preview from this directory:

```bash
npm run build
npm run preview
```

The Dockerfile builds with API base `/api`, and Nginx proxies that relative route to `http://gateway:8000`. Don't hardcode `localhost` in a production bundle: that would refer to the visitor's machine. The uploaded archive carried Windows-only preinstalled Node modules; install platform-specific dependencies with `npm ci` on the target machine instead of copying `node_modules`.
