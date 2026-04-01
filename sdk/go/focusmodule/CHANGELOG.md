# Changelog

Все заметные изменения в Go SDK (`focusmodule`) документируются в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/).

## [Unreleased]

## [0.1.0] - 2026-04-01

### Added
- `fm.Run()` — единая точка входа, скрывает boilerplate (DB, mux, health, server)
- `App` — структура с DB, Mux, Manifest для доступа из setup-функции
- `Config` — конфигурация модуля (SettingsTable)
- Чтение `manifest.json` при старте (id, name, events)
- `Broadcast()` — отправка WebSocket-событий с валидацией по manifest
- `RequireRole()`, `UserRole()` — RBAC middleware и хелпер
- Константы ролей: `RoleGuest`, `RoleResident`, `RoleOwner`
- `settingsHandler` — generic JSON CRUD для настроек модуля
- `OpenDB()` — SQLite с WAL, FK ON, MaxOpenConns=1
- `JSON()`, `HTTPError()`, `InternalError()` — response helpers
- `HealthHandler` — эндпоинт /health
- `ListenAndServe()` — focus-module/1 handshake + HTTP server
