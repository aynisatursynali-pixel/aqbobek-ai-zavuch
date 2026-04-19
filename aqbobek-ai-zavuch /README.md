# Aqbobek AI Zavuch

AI-завуч для школьного операционного управления: attendance, инциденты, задачи, замены, документный copilot и dashboard директора.

## Что умеет проект

- собирать attendance из свободного текста;
- считать сводку для столовой;
- распознавать инциденты и создавать задачи;
- строить предложения по заменам;
- показывать тепловую карту нагрузки и конфликты расписания;
- вести уведомления и audit trail;
- помогать с приказами и отчетами через Gemini + regulation retrieval;
- работать через web-dashboard и Telegram-бота.

## Стек

- `Python 3.14`
- `Flask`
- `python-telegram-bot`
- `SQLite` для операционных сущностей
- `Gemini API`
- `HTML/CSS/JS`

## Быстрый запуск

### 1. Подготовить окружение

```bash
cd /Users/macbook/Desktop/aqbobek-ai-zavuch
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Проверить `.env`

Файл уже существует: [/.env](/Users/macbook/Desktop/aqbobek-ai-zavuch/.env)

Минимум нужно:

- `GEMINI_API_KEY`
- `TELEGRAM_BOT_TOKEN` для бота

### 3. Запустить backend

Если `5000` занят, используйте `5050`:

```bash
python3 backend/server.py --port 5050
```

Открыть:

- [http://127.0.0.1:5050](http://127.0.0.1:5050)

### 4. Запустить Telegram-бота

Во втором терминале:

```bash
cd /Users/macbook/Desktop/aqbobek-ai-zavuch
source .venv/bin/activate
python3 backend/bot.py
```

## Полезные URL

- Dashboard: [http://127.0.0.1:5050](http://127.0.0.1:5050)
- AI status: [http://127.0.0.1:5050/api/ai/status](http://127.0.0.1:5050/api/ai/status)
- Notifications: [http://127.0.0.1:5050/api/notifications](http://127.0.0.1:5050/api/notifications)
- Audit: [http://127.0.0.1:5050/api/audit](http://127.0.0.1:5050/api/audit)
- Schedule conflicts: [http://127.0.0.1:5050/api/schedule/conflicts?day=%D0%94%D2%AF%D0%B9%D1%81%D0%B5%D0%BD%D0%B1%D1%96](http://127.0.0.1:5050/api/schedule/conflicts?day=%D0%94%D2%AF%D0%B9%D1%81%D0%B5%D0%BD%D0%B1%D1%96)

## Проверка работоспособности

### Быстрый smoke test API

```bash
curl http://127.0.0.1:5050/api/ai/status
curl http://127.0.0.1:5050/api/notifications
curl "http://127.0.0.1:5050/api/schedule/conflicts?day=Дүйсенбі"
```

### Проверка AI intake

```bash
curl -X POST http://127.0.0.1:5050/api/ai/process \
  -H "Content-Type: application/json" \
  -d '{"text":"Айгерим, подготовь актовый зал. Назкен, закажи воду и бейджи.","source":"readme_demo","persist":false}'
```

### Проверка document copilot

```bash
curl -X POST http://127.0.0.1:5050/api/regulations/assist \
  -H "Content-Type: application/json" \
  -d '{"query":"Подготовь внутренний приказ о проведении школьного хакатона на следующей неделе.","document_code":"130"}'
```

## Тесты

```bash
python3 -m unittest discover -s tests -v
```

## Структура

- [backend/server.py](/Users/macbook/Desktop/aqbobek-ai-zavuch/backend/server.py): Flask API
- [backend/bot.py](/Users/macbook/Desktop/aqbobek-ai-zavuch/backend/bot.py): Telegram-бот
- [backend/gemini_ai.py](/Users/macbook/Desktop/aqbobek-ai-zavuch/backend/gemini_ai.py): Gemini structured extraction
- [backend/school_ops.py](/Users/macbook/Desktop/aqbobek-ai-zavuch/backend/school_ops.py): логика школы
- [backend/storage.py](/Users/macbook/Desktop/aqbobek-ai-zavuch/backend/storage.py): SQLite storage + audit + notifications
- [frontend/index.html](/Users/macbook/Desktop/aqbobek-ai-zavuch/frontend/index.html): layout
- [frontend/app.js](/Users/macbook/Desktop/aqbobek-ai-zavuch/frontend/app.js): dashboard logic
- [data/regulations.json](/Users/macbook/Desktop/aqbobek-ai-zavuch/data/regulations.json): regulation metadata
- [data/regulation_chunks.json](/Users/macbook/Desktop/aqbobek-ai-zavuch/data/regulation_chunks.json): retrieval chunks

## Известные ограничения

- это все еще MVP, а не production ERP;
- WhatsApp-интеграция не реализована;
- нет полноценной авторизации по ролям;
- document assistant опирается на curated regulation chunks, а не на полный индекс PDF корпуса.
