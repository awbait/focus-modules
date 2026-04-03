# Changelog

Все заметные изменения в `@focus-dashboard/sdk-types` документируются в этом файле.

## [Unreleased]

## [0.9.0] - 2026-04-03

### Added
- `getPortalContainer()` метод в `FocusInstance` — возвращает DOM-контейнер для порталов
- `PortalContainerContext` — React Context для проброса portal container в модули
- `usePortalContainer()` хук — читает portal container из контекста
- `registerWidget()` автоматически оборачивает компонент в `PortalContainerContext.Provider`

## [0.8.0] - 2026-04-02

### Added
- `FocusPublicUser` интерфейс — публичная информация о пользователе (id, name, avatar)
- `getUsers()` метод в `FocusInstance` — получение списка пользователей платформы (кешируется)

## [0.7.0] - 2026-04-01

### Added
- `focus-build` bin entry — модули могут использовать `"build": "focus-build"` в package.json

## [0.6.0] - 2026-04-01

### Added
- Экспорт `./build` — общий скрипт сборки модулей (widget.js + settings.js)

## [0.5.0] - 2026-04-01

### Added
- `registerWidget()` — регистрация React-компонента как custom element одной строкой
- `usePermission()` — реактивный хук проверки прав (guest/resident/owner)
- `baseStyles` — общие CSS-стили для виджетов (widget, disabled)
- Runtime-экспорты (`import`/`default` conditions в package.json)

## [0.4.0] - 2026-03-30

### Added
- Перенос sdk-types в focus-modules, workflow публикации в npm
- Типы: `FocusInstance`, `FocusSDKGlobal`, `FocusUser`, `FocusAction`
- `ReactWidgetElement` — базовый класс для React custom elements
- `WidgetProps`, `Styles` — вспомогательные типы
- `globals.d.ts` — глобальные декларации `window.FocusSDK`
