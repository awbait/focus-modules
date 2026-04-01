# Релизный процесс

## Обзор

Каждый пакет имеет свой `CHANGELOG.md` в формате [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/).
Релиз триггерится git-тегом. CI создаёт GitHub Release с заметками из CHANGELOG.

| Пакет | Путь | Формат тега | Что делает CI |
|-------|------|-------------|---------------|
| TS SDK | `sdk/ts/sdk-types/` | `sdk-types/vX.Y.Z` | npm publish + GitHub Release |
| Go SDK | `sdk/go/focusmodule/` | `sdk/go/focusmodule/vX.Y.Z` | GitHub Release (Go proxy подхватывает тег сам) |
| Модуль | `modules/<id>/` | `<id>/vX.Y.Z` | ZIP build + GitHub Release + обновление community-modules.json |

## Просмотр изменений с последнего релиза

```bash
# sdk-types
git log sdk-types/v0.7.0..HEAD -- sdk/ts/sdk-types/

# Go SDK
git log sdk/go/focusmodule/v0.1.0..HEAD -- sdk/go/focusmodule/

# Модуль
git log example-counter/v1.1.0..HEAD -- modules/example-counter/
```

## Релиз sdk-types (TypeScript SDK)

1. Обновить `sdk/ts/sdk-types/CHANGELOG.md`:
   - Переименовать `[Unreleased]` → `[X.Y.Z] - YYYY-MM-DD`
   - Добавить пустой `[Unreleased]` сверху
2. Обновить `version` в `sdk/ts/sdk-types/package.json`
3. Коммит, тег, push:
   ```bash
   git add sdk/ts/sdk-types/CHANGELOG.md sdk/ts/sdk-types/package.json
   git commit -m "chore(sdk-types): release vX.Y.Z"
   git tag sdk-types/vX.Y.Z
   git push origin main sdk-types/vX.Y.Z
   ```
4. CI публикует в npm и создаёт GitHub Release

## Релиз Go SDK

1. Обновить `sdk/go/focusmodule/CHANGELOG.md`
2. Коммит, тег, push:
   ```bash
   git add sdk/go/focusmodule/CHANGELOG.md
   git commit -m "chore(focusmodule): release vX.Y.Z"
   git tag sdk/go/focusmodule/vX.Y.Z
   git push origin main sdk/go/focusmodule/vX.Y.Z
   ```
3. CI создаёт GitHub Release. Go proxy подхватывает тег автоматически.

## Релиз модуля

1. Обновить `modules/<id>/CHANGELOG.md`
2. Коммит, тег, push:
   ```bash
   git add modules/<id>/CHANGELOG.md
   git commit -m "chore(<id>): release vX.Y.Z"
   git tag <id>/vX.Y.Z
   git push origin main <id>/vX.Y.Z
   ```
3. CI собирает ZIP (frontend + backend), создаёт GitHub Release, обновляет `community-modules.json`

## Версионирование

Используем [Semantic Versioning](https://semver.org/):
- `feat:` коммиты → minor bump (0.7.0 → 0.8.0)
- `fix:` коммиты → patch bump (0.7.0 → 0.7.1)
- `BREAKING CHANGE` → major bump (0.7.0 → 1.0.0)

## Формат CHANGELOG

```markdown
# Changelog

Все заметные изменения документируются в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/).

## [Unreleased]

## [0.2.0] - 2026-04-15

### Added
- Описание новой функциональности

### Changed
- Описание изменений

### Fixed
- Описание исправлений

## [0.1.0] - 2026-04-01

### Added
- Первый релиз
```

Категории: **Added**, **Changed**, **Deprecated**, **Removed**, **Fixed**, **Security**.
