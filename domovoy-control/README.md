# domovoy-control

focus-dashboard module — control panel widget for the
[Domovoy](../../domovoy) voice assistant.

## Build

```bash
bash build.sh    # → domovoy-control.zip
```

## Install

Upload `domovoy-control.zip` via **focus-dashboard → Admin → Modules → Upload**.

## API

Proxied under `/api/modules/domovoy-control/api/`:

| Method | Path        | Description             |
|--------|-------------|-------------------------|
| GET    | `/health`   | Readiness probe         |
| GET    | `/status`   | Current assistant state |
| POST   | `/command`  | Send a text command     |
| GET    | `/manifest` | Module metadata         |
