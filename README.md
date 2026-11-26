# Сервісний центр Apple / Samsung

Backend-застосунок для сервісного центру, що ремонтує смартфони Apple та Samsung і продає запчастини.

Система обліковує клієнтів та їхні пристрої, ремонтні замовлення, роботу майстрів, склад запчастин і продажі в магазині.

Курсова робота з дисципліни «Бази даних».

## Команда

КПІ ім. Ігоря Сікорського, ФІОТ, група ІМ-55.

| Учасник |
|---|
| Останін Олександр |
| Михайлик Олексій |

Детальний внесок кожного учасника — у [CONTRIBUTIONS.md](CONTRIBUTIONS.md).

## Технології

| Компонент | Технологія |
|---|---|
| Мова програмування | TypeScript |
| Середовище виконання | Node.js 22+ |
| База даних | PostgreSQL 18 |
| ORM | Prisma 7 |
| Вебсервер | Fastify 5 |
| Валідація | Zod |
| Тестування | Vitest |
| Контейнеризація | Docker Compose |

## Основні можливості

- Приймання пристроїв у ремонт.
- Керування статусами ремонтних замовлень.
- Призначення майстрів.
- Облік запчастин та їх сумісності з моделями.
- Оформлення замовлень магазину.
- Контроль складських залишків.
- Оптимістичне та песимістичне блокування.
- М'яке видалення клієнтів.
- Жорстке видалення скасованих ремонтів.
- Аналітичні SQL-запити.
- Генерація демонстраційних даних.
- Інтеграційне тестування.

## Необхідне програмне забезпечення

- [Git](https://git-scm.com/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Node.js](https://nodejs.org/) версії 22 або новішої для локального запуску.

## Встановлення

Клонувати репозиторій:

```bash
git clone https://github.com/AlegZabivnoy/Course-Work-DB-.git
cd Course-Work-DB-
```

Створити файл `.env` на основі `.env.example`:

```bash
cp .env.example .env
```

Приклад конфігурації для локального середовища:

```env
DB_USER=coursework
DB_PASSWORD=change_me
DB_NAME=coursework
DB_PORT=5433
DATABASE_URL="postgresql://coursework:change_me@localhost:5433/coursework?schema=public"
PORT=3000
```

У разі зміни пароля необхідно узгодити значення
DB_PASSWORD та DATABASE_URL.

Файл `.env` не додається до Git.

## Запуск через Docker

Переконатися, що Docker Desktop запущений.

Виконати:

```bash
docker compose up --build -d
```

Docker Compose автоматично:

1. Запускає PostgreSQL.
2. Перевіряє доступність бази даних через healthcheck.
3. Збирає образ застосунку.
4. Генерує Prisma Client під час збірки.
5. Застосовує міграції.
6. Заповнює довідникові таблиці через seed.
7. Запускає Fastify.
8. Перевіряє доступність застосунку.

Перевірка контейнерів:

```bash
docker compose ps
```

Перегляд логів застосунку:

```bash
docker compose logs app
```

API доступне за адресою:

http://localhost:3000

Перевірка стану застосунку:

http://localhost:3000/health

Очікувана відповідь:

```json
{
  "status": "ok",
  "database": "up"
}
```

Для зупинки контейнерів:

```bash
docker compose down
```

Дані PostgreSQL зберігаються у Docker volume.

## Локальний запуск застосунку

Якщо застосунок запускається через Node.js,
а PostgreSQL працює в Docker:

### 1. Встановити залежності

```bash
npm ci
```

### 2. Запустити PostgreSQL

```bash
docker compose up -d db
```

### 3. Згенерувати Prisma Client

```bash
npm run db:generate
```

### 4. Застосувати міграції

```bash
npm run db:migrate
```

### 5. Заповнити довідникові таблиці

```bash
npm run db:seed
```

### 6. Запустити застосунок

```bash
npm run dev
```

Якщо контейнер app уже запущено, перед локальним
запуском необхідно його зупинити:

```bash
docker compose stop app
```

Це дозволить уникнути конфлікту порту 3000.

## Демонстраційні дані

Для демонстрації роботи системи передбачено
скрипт prisma/demo.ts.

Локальний запуск:

```bash
npm run db:demo
```

Запуск через Docker:

```bash
docker compose exec app npm run db:demo
```

Скрипт створює:

| Сутність | Кількість |
|---|---:|
| Клієнти | 30 |
| Пристрої | 40 |
| Ремонтні замовлення | 90 |
| Замовлення магазину | 70 |
| Залишки активних запчастин | 10–50 одиниць |

Ремонти та замовлення розподіляються за поточним
і п'ятьма попередніми календарними місяцями.

Особливості генерації:

- Фіксоване початкове значення генератора випадкових чисел.
- Виконання в межах однієї транзакції.
- Захист від повторного запуску.
- Захист від одночасного запуску генератора.
- Дотримання CHECK-обмежень.
- Використання лише сумісних запчастин у ремонтах.
- Формування поточного стану складу без списання
  залишків за історичними операціями.

Під час повторного запуску виводиться:

```text
Demo data already loaded, skipped
```

Демонстраційні дані призначені для навчального середовища.

## API ремонтного сервісу

| Метод | Ендпоінт | Призначення |
|---|---|---|
| POST | /repairs | Приймання пристрою в ремонт |
| POST | /repairs/:id/parts | Додавання запчастини до ремонту |
| PATCH | /repairs/:id/status | Зміна статусу ремонту |
| DELETE | /repairs/:id | Видалення скасованого ремонту |
| GET | /repairs | Список ремонтів із фільтрацією та пагінацією |
| GET | /customers/:id/devices | Пристрої активного клієнта |

Приклади HTTP-запитів:

[http/repairs.http](http/repairs.http)

## API магазину запчастин

| Метод | Ендпоінт | Призначення |
|---|---|---|
| POST | /shop-orders | Створення замовлення та списання залишків |
| PATCH | /parts/:id | Оновлення ціни та складу з перевіркою version |
| DELETE | /customers/:id | М'яке видалення клієнта |
| GET | /parts | Каталог запчастин із фільтрацією, сортуванням та пагінацією |
| GET | /parts/search?q=battery | Пошук запчастин за назвою через ILIKE |

Приклади HTTP-запитів:

- [Замовлення магазину](http/shop-orders.http)
- [Запчастини](http/parts.http)
- [Клієнти](http/customers.http)

Перед створенням замовлення необхідно мати
активного клієнта.

## Аналітичні запити

| Ендпоінт | Призначення |
|---|---|
| GET /analytics/top-parts | Топ-3 запчастини за виручкою в кожній категорії |
| GET /analytics/monthly-sales | Продажі за місяцями та їх динаміка |
| GET /analytics/model-reliability | Аналіз надійності моделей смартфонів |

Аналітичні запити використовують:

- JOIN;
- GROUP BY;
- HAVING;
- агрегатні функції;
- CTE;
- ROW_NUMBER;
- RANK;
- LAG.

Приклади запитів: [http/analytics.http](http/analytics.http).

Пояснення SQL та результати виконання:

[docs/queries.md](docs/queries.md)

## Приклади використання API

Отримання каталогу запчастин:

```bash
curl http://localhost:3000/parts
```

Пошук акумуляторів:

```bash
curl "http://localhost:3000/parts/search?q=battery"
```

Отримання топ-3 запчастин:

```bash
curl http://localhost:3000/analytics/top-parts
```

Отримання продажів за місяцями:

```bash
curl http://localhost:3000/analytics/monthly-sales
```

## Тестування

Для інтеграційного тестування використовується Vitest.

Тести виконуються на окремій базі даних із суфіксом
_test, наприклад coursework_test.

Тестова інфраструктура автоматично створює базу
за необхідності, застосовує міграції та очищає
таблиці перед тестами, які використовують resetDb.

Основна база даних coursework не очищається.

### Запуск усіх тестів

Перед локальним запуском тестів необхідно
встановити залежності, згенерувати Prisma Client
та запустити PostgreSQL:

```bash
npm ci
npm run db:generate
docker compose up -d db
npm test
```

### Запуск окремого тестового файлу

```bash
npx vitest run tests/shop-orders.test.ts
```

### Запуск тестів у режимі спостереження

```bash
npm run test:watch
```

### Запуск тестів через Docker

За наявності запущеного контейнера app:

```bash
docker compose exec app npm test
```

### Покриття тестами

| Файл | Кількість тестів |
|---|---:|
| repairs-intake.test.ts | 12 |
| repairs-status.test.ts | 12 |
| repair-analytics.test.ts | 6 |
| shop-orders.test.ts | 4 |
| parts.test.ts | 11 |
| customers.test.ts | 5 |
| shop-analytics.test.ts | 4 |
| smoke.test.ts | 2 |
| **Всього** | **56** |

Тести перевіряють:

- створення пов'язаних сутностей у транзакціях;
- відкат операцій при помилках;
- перевірку складських залишків;
- конкурентні операції;
- оптимістичне та песимістичне блокування;
- м'яке і жорстке видалення;
- фільтрацію, сортування та пагінацію;
- правильність результатів аналітичних запитів;
- обробку HTTP-помилок.

Станом на 26.11.2026 всі 56 тестів успішно
пройдено при локальному запуску з PostgreSQL у Docker.

## Структура проєкту

```text
Course-Work-DB-/
├── docs/
│   ├── schema.md
│   └── queries.md
├── http/
├── prisma/
│   ├── migrations/
│   ├── schema.prisma
│   ├── seed.ts
│   ├── seed-data.ts
│   └── demo.ts
├── src/
│   ├── db/
│   ├── repositories/
│   ├── services/
│   ├── routes/
│   ├── errors.ts
│   ├── app.ts
│   └── server.ts
├── tests/
├── .dockerignore
├── .env.example
├── .gitignore
├── CONTRIBUTIONS.md
├── Dockerfile
├── docker-compose.yml
├── package.json
├── package-lock.json
├── prisma7.config.ts
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

Застосунок побудовано за багатошаровою архітектурою:

Routes → Services → Repositories → PostgreSQL.

Routes відповідають за HTTP-запити та валідацію.

Services реалізують бізнес-логіку і транзакції.

Repositories забезпечують доступ до бази даних.

Prisma використовується для ORM-операцій,
а складні аналітичні запити реалізовано через SQL.

## Основні команди

| Команда | Призначення |
|---|---|
| npm ci | Встановлення залежностей за lock-файлом |
| npm run dev | Запуск застосунку в режимі розробки |
| npm start | Звичайний запуск застосунку |
| npm run db:generate | Генерація Prisma Client |
| npm run db:migrate | Застосування міграцій |
| npm run db:seed | Заповнення довідників |
| npm run db:demo | Генерація демонстраційних даних |
| npm test | Запуск усіх тестів |
| npm run test:watch | Запуск тестів у режимі спостереження |
| docker compose up --build -d | Збірка та запуск усієї системи |
| docker compose up -d db | Запуск лише PostgreSQL |
| docker compose ps | Перевірка стану контейнерів |
| docker compose down | Зупинка контейнерів зі збереженням даних |

## Документація

- [Схема бази даних та ER-діаграма](docs/schema.md)
- [Аналітичні SQL-запити](docs/queries.md)
- [Внески учасників команди](CONTRIBUTIONS.md)

## Можливі проблеми

| Проблема | Рішення |
|---|---|
| Не знайдено .env | Створити файл на основі .env.example |
| Docker не підключається | Перевірити запуск Docker Desktop |
| Не знайдено package.json | Перейти до кореневої папки проєкту |
| Не знайдено Prisma Client | Виконати npm run db:generate |
| Prisma P1000 | Перевірити пароль користувача PostgreSQL та DATABASE_URL |
| Порт 3000 зайнятий | Зупинити інший екземпляр застосунку |
| Cannot find native binding | Перевірити встановлення платформозалежних npm-залежностей |
| Demo data already loaded | Демонстраційні дані вже завантажено |

Увага: команда docker compose down -v видаляє
томи бази даних разом із збереженими даними.