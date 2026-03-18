# domovoy-control

Модуль для focus-dashboard — виджет управления голосовым ассистентом
[Домовой](../../domovoy).

## Сборка

```bash
bash build.sh    # → domovoy-control.zip
```

## Установка

Загрузить `domovoy-control.zip` через **focus-dashboard → Администрирование → Модули → Загрузить**.

## API

Доступно по пути `/api/modules/domovoy-control/api/`:

| Метод | Путь        | Описание                     |
|-------|-------------|------------------------------|
| GET   | `/health`   | Readiness probe              |
| GET   | `/status`   | Текущее состояние ассистента |
| POST  | `/command`  | Отправить текстовую команду  |
| GET   | `/manifest` | Метаданные модуля            |
