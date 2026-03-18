# focus-modules

External modules for [focus-dashboard](../focus-dashboard).

Each module is a self-contained directory that packages into a `.zip` and is
installed via the focus-dashboard admin panel — no recompilation of the host
app required.

---

## Module structure

```
my-module/
├── manifest.json       # required — id, name, version, description
├── migrations.sql      # optional — SQL run against the main DB on install
├── frontend/           # optional — widget source (TypeScript + Vite)
│   ├── src/widget.tsx
│   ├── vite.config.ts
│   └── package.json
├── backend/            # optional — Go HTTP server (focus-module/1 protocol)
│   ├── main.go
│   └── go.mod
├── build.sh            # packages everything into {id}.zip
└── build.ps1           # same, for Windows
```

**At least one of** `frontend/` (widget.js) or `backend/` is required.

---

## manifest.json

```json
{
  "id": "my-module",
  "name": "My Module",
  "description": "What it does",
  "version": "0.1.0",
  "author": "you"
}
```

---

## Backend protocol (focus-module/1)

The backend binary must:

1. Read `PORT` from env — the host assigns a free port from its pool.
2. Bind the TCP listener on `127.0.0.1:{PORT}` **before** writing the handshake.
3. Write a single JSON line to stdout:
   ```json
   {"protocol":"focus-module/1","port":8700,"name":"my-module"}
   ```
4. Expose `GET /health` → `200 OK` (used by the host for readiness check).

The host reverse-proxies `/api/modules/{id}/api/*` → `/{rest}` on the backend.

---

## Building

```bash
cd my-module
bash build.sh        # → my-module.zip
```

The script builds the frontend (bun), compiles the backend (linux/amd64), and
packages `manifest.json`, `widget.js`, `migrations.sql`, and `backend` into a ZIP.

---

## Installing

Upload the `.zip` via **focus-dashboard → Admin → Modules → Upload**.

The module appears in the module list immediately (no restart needed).
To add the widget to a dashboard, enter edit mode and click **Add widget**.
