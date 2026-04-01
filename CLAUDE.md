# focus-modules — Инструкции для Claude

## Структура репозитория

Монорепо с тремя типами пакетов:

| Пакет | Путь | Тег | Публикация |
|-------|------|-----|------------|
| Go SDK | `sdk/go/focusmodule/` | `sdk/go/focusmodule/vX.Y.Z` | Go proxy (автоматически) |
| TS SDK | `sdk/ts/sdk-types/` | `sdk-types/vX.Y.Z` | npm (`publish-sdk-types.yml`) |
| Модуль | `modules/<id>/` | `<id>/vX.Y.Z` | GitHub Release ZIP (`release-module.yml`) |

## Релизный процесс

Подробнее — см. [RELEASING.md](RELEASING.md).

1. Обновить `CHANGELOG.md` в директории пакета (формат Keep a Changelog)
2. Для sdk-types: обновить `version` в `package.json`
3. Коммит: `chore(<scope>): release vX.Y.Z`
4. Тег: формат из таблицы выше
5. Push коммит + тег — CI создаст GitHub Release

## Формат CHANGELOG.md

Файл ведётся вручную в формате https://keepachangelog.com/ru/1.1.0/

Секция `[Unreleased]` — накопитель. При релизе переименовывается в `[X.Y.Z] - YYYY-MM-DD`.

Категории: Added, Changed, Deprecated, Removed, Fixed, Security.

## Правила

- Пакетный менеджер: **Bun** (не npm/yarn)
- Коммиты: conventional commits, scope = имя пакета
- Ветки: feature branch + PR, никогда не пушить в main напрямую
- Исключение: коммит релиза (version bump + CHANGELOG) пушится в main с тегом
- Язык ответов: русский
