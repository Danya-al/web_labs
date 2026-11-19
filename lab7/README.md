# Лабораторная работа № 7. Контакты

Вариант 8. REST API на Express с хранением контактов в PostgreSQL. Таблица `contacts` содержит поля `id`, `name`, `phone` и `email`. Идентификатор генерируется базой данных.

## Запуск

Понадобятся Node.js 22.9 или новее и запущенный PostgreSQL. Создайте базу `lab7_contacts` в pgAdmin или выполните SQL в любой существующей базе, например `postgres`.

```sql
CREATE DATABASE lab7_contacts;
```

В PowerShell из папки `web_labs` выполните команды:

```powershell
cd lab7
npm ci
Copy-Item .env.example .env
```

Откройте `.env`, укажите пользователя, пароль и при необходимости измените хост и порт PostgreSQL. Пользователю нужны права на создание таблицы в этой базе. Затем запустите сервер командой `npm start`. Сервер создаст таблицу из `schema.sql` при первом запуске. По умолчанию он доступен на `http://127.0.0.1:3007`.

## Маршруты

| Метод и путь | Действие | Успешный ответ |
| --- | --- | --- |
| `GET /api/contacts` | Получить список контактов | `200 OK` |
| `POST /api/contacts` | Создать контакт | `201 Created` и созданный контакт |
| `PUT /api/contacts/:id` | Заменить имя, телефон и email | `200 OK` и обновлённый контакт |
| `DELETE /api/contacts/:id` | Удалить контакт | `204 No Content` |

Для `POST` и `PUT` передайте JSON с непустыми строками `name`, `phone` и `email`. Некорректные данные дают `400 Bad Request`. При обновлении или удалении отсутствующего контакта API возвращает `404 Not Found`.

Для `GET` можно передать `q` для поиска по подстроке в имени, телефоне или email без учёта регистра. `page` и `limit` должны быть положительными целыми числами. По умолчанию используются `page=1` и `limit=10`. Отрицательный `limit` даёт `400 Bad Request`. Ответ содержит `contacts`, `total`, `page` и `limit`. Поле `total` показывает число контактов, подходящих под поиск, до применения пагинации. Без `q` оно показывает число всех контактов.

## Проверка через PowerShell

```powershell
$api = 'http://127.0.0.1:3007/api/contacts'
$body = @{ name = 'Alex'; phone = '+79991234567'; email = 'alex@example.com' }
$created = Invoke-RestMethod -Uri $api -Method Post -ContentType 'application/json' -Body ($body | ConvertTo-Json)

Invoke-RestMethod -Uri "${api}?q=Alex&page=1&limit=10"
Invoke-RestMethod -Uri "${api}?q=Alex&page=2&limit=10"

$contactUrl = "$api/$($created.id)"
$body.name = 'Alexander'
Invoke-RestMethod -Uri $contactUrl -Method Put -ContentType 'application/json' -Body ($body | ConvertTo-Json)
Invoke-RestMethod -Uri $contactUrl -Method Delete

# Ожидается HTTP 400
Invoke-RestMethod -Uri "${api}?limit=-1"
```
