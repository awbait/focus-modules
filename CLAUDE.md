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

1. Ветка `release/<package>/vX.Y.Z` от main
2. Обновить `CHANGELOG.md` (и `package.json` для sdk-types)
3. PR → мерж
4. Тег на merge-коммит в main → push тег
5. CI создаёт GitHub Release

## Формат CHANGELOG.md

Файл ведётся вручную в формате https://keepachangelog.com/ru/1.1.0/

Секция `[Unreleased]` — накопитель. При релизе переименовывается в `[X.Y.Z] - YYYY-MM-DD`.

Категории: Added, Changed, Deprecated, Removed, Fixed, Security.

## Правила

- Пакетный менеджер: **Bun** (не npm/yarn)
- Коммиты: conventional commits, scope = имя пакета
- Ветки: feature branch + PR, **никогда не пушить в main напрямую** (main protected)
- **Никогда не удалять теги, ветки, релизы** — если тег невалидный, создать новый с новой версией
- **Никогда не force push**
- Язык ответов: русский
