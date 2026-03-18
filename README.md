# focus-modules

Внешние модули для [focus-dashboard](../focus-dashboard).

Каждый модуль — самостоятельная директория, которая собирается в `.zip` и
устанавливается через панель администратора. Перекомпилировать host-приложение
не нужно.

---

## Структура модуля

```
my-module/
├── manifest.json       # обязательно — id, name, version, description
├── migrations.sql      # опционально — SQL, выполняется при установке
├── frontend/           # опционально — исходник виджета (TypeScript + Vite)
│   ├── src/widget.tsx
│   ├── vite.config.ts
│   └── package.json
├── backend/            # опционально — Go HTTP-сервер (протокол focus-module/1)
│   ├── main.go
│   └── go.mod
├── build.sh            # сборка ZIP (Linux / macOS)
└── build.ps1           # сборка ZIP (Windows)
```

Обязательно наличие хотя бы одного из: `frontend/` (widget.js) или `backend/`.

---

## manifest.json

```json
{
  "id": "my-module",
  "name": "Мой модуль",
  "description": "Что делает",
  "version": "0.1.0",
  "author": "автор"
}
```

---

## Протокол бэкенда (focus-module/1)

Бинарник бэкенда обязан:

1. Прочитать `PORT` из окружения — хост выделяет свободный порт из пула.
2. Открыть TCP-listener на `127.0.0.1:{PORT}` **до** записи handshake.
3. Вывести одну JSON-строку в stdout:
   ```json
   {"protocol":"focus-module/1","port":8700,"name":"my-module"}
   ```
4. Отвечать `200 OK` на `GET /health` — хост использует это как readiness probe.

Хост проксирует `/api/modules/{id}/api/*` → `/{rest}` на бэкенд модуля.

---

## Сборка

```bash
cd my-module
bash build.sh        # → my-module.zip
```

Скрипт собирает фронтенд (bun), компилирует бэкенд (linux/amd64) и упаковывает
`manifest.json`, `widget.js`, `migrations.sql` и `backend` в ZIP.

---

## Установка

Загрузить `.zip` через **focus-dashboard → Администрирование → Модули → Загрузить**.

Модуль появляется в списке сразу, без перезапуска.
Чтобы добавить виджет на доску, войдите в режим редактирования и нажмите **Добавить виджет**.
