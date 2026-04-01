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

## Общий процесс

Все релизы идут через ветку и PR:

1. Создать ветку `release/<package>/vX.Y.Z` от main
2. Обновить `CHANGELOG.md` пакета (переименовать `[Unreleased]` → `[X.Y.Z] - YYYY-MM-DD`)
3. Закоммитить, запушить, создать PR
4. После мержа PR — поставить тег на merge-коммит в main и запушить тег
5. CI создаёт GitHub Release с notes из CHANGELOG

```bash
# 1. Ветка
git checkout main && git pull origin main
git checkout -b release/<package>/vX.Y.Z

# 2. Обновить CHANGELOG + (для sdk-types) version в package.json
# ...

# 3. PR
git add <files>
git commit -m "chore(<scope>): release vX.Y.Z"
git push -u origin release/<package>/vX.Y.Z
gh pr create --title "release: <package> vX.Y.Z" --body "..."

# 4. После мержа — тег
git checkout main && git pull origin main
git tag <tag>
git push origin <tag>
```

## Релиз sdk-types (TypeScript SDK)

- Путь: `sdk/ts/sdk-types/`
- Обновить: `CHANGELOG.md` + `package.json` (version)
- Scope коммита: `sdk-types`
- Формат тега: `sdk-types/vX.Y.Z`
- CI: npm publish + GitHub Release

## Релиз Go SDK

- Путь: `sdk/go/focusmodule/`
- Обновить: `CHANGELOG.md`
- Scope коммита: `focusmodule`
- Формат тега: `sdk/go/focusmodule/vX.Y.Z`
- CI: GitHub Release. Go proxy подхватывает тег автоматически.

## Релиз модуля

- Путь: `modules/<id>/`
- Обновить: `CHANGELOG.md`
- Scope коммита: `<id>`
- Формат тега: `<id>/vX.Y.Z`
- CI: ZIP build + GitHub Release + обновление `community-modules.json`

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
