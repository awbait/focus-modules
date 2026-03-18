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

Все ручки доступны по префиксу `/api/modules/domovoy-control/api/`.

### GET /health

Readiness probe — используется хостом при запуске.

```json
{"status":"ok"}
```

### GET /status

Текущее состояние ассистента.

```json
{"running": true, "state": "idle"}
{"running": true, "state": "listening", "since": "2025-01-01T12:00:00Z"}
```

Возможные значения `state`: `idle`, `listening`.

### POST /command

Отправить текстовую команду ассистенту.

Запрос:
```json
{"command": "включи свет"}
```

Ответ `200`:
```json
{"status": "accepted"}
```

После получения команды состояние переходит в `listening`, через 3 секунды возвращается в `idle`
(временная заглушка — в финальной версии будет реальный вызов Домового через gRPC).

### GET /manifest

Метаданные модуля.

```json
{"id": "domovoy-control", "name": "Домовой", "version": "0.1.0"}
```
