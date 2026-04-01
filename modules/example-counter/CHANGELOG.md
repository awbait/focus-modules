# Changelog

Все заметные изменения в модуле `example-counter` документируются в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/).

## [Unreleased]

### Changed
- Бэкенд использует `fm.Run()` из Go SDK (убран boilerplate)
- Фронтенд использует `registerWidget`, `usePermission`, `baseStyles` из sdk-types
- Сборка через `focus-build` (build.ts удалён)
- React подключается через import map хоста (убран shim plugin)

## [1.1.0] - 2026-03-30

### Added
- Панель настроек (settings widget) с RBAC
- i18n: локали en.json, ru.json
- Preview-изображение модуля

### Changed
- Фронтенд переписан на TypeScript/TSX
- Виджеты используют React через window.React/ReactDOM
- Типы вынесены в @focus-dashboard/sdk-types

## [1.0.0] - 2026-03-28

### Added
- Виджет-счётчик с increment/decrement/reset
- Виджет истории (chart) с SVG-графиком
- REST API: GET /value, POST /increment, POST /decrement, POST /reset
- WebSocket-события: value.changed
- SQLite миграции (ec_values, ec_settings)
- Build-скрипты для Linux/macOS и Windows
