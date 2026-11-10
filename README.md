# Мои Финансы — семейное PWA

Мобильный прототип учёта семейных финансов на React, IndexedDB и GitHub Pages.

**Внимание:** это локальный прототип. PIN, синхронизация с Google Sheets и проверка серверной авторизации пока не реализованы. Не вводите реальные финансовые данные.

При первом входе можно сохранить URL опубликованного Google Apps Script или отсканировать QR. Ссылка хранится в IndexedDB на текущем устройстве. Само сохранение URL не означает успешное подключение.

## Локальный запуск

```bash
npm install
npm run dev
```

## Сборка

```bash
npm run build
```

GitHub Pages: Settings → Pages → Source → GitHub Actions. Workflow публикует `dist` при push в `main`.

Backend Apps Script публикуется отдельно с помощью `clasp`, не через Pages. Не добавляйте `.clasp.json`, токены и финансовые данные в публичный репозиторий.
