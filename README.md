# compressor-service-platform

## Required Environment Variables

- `CRON_SECRET` - secret key for protecting cron endpoint.
  - Example value for Railway Variables: `CRON_SECRET=any_secret_key`

## Automatic Moto-hour Updates

- Endpoint: `POST /api/cron/update-hours`
- Protection: send `Authorization: Bearer <CRON_SECRET>` or header `x-cron-secret: <CRON_SECRET>`
- Formula used each hour for every equipment with configured mode:
  - `(hoursPerDay * daysPerWeek) / 7 / 24`
- Only equipment with both `hoursPerDay` and `daysPerWeek` set are updated.
- Each update is written to audit history with comment `Автоматическое обновление`.

### Scheduler options

- **Vercel Cron**: call `POST /api/cron/update-hours` hourly and pass `CRON_SECRET`.
- **Railway**: `node-cron` is started inside app runtime (`apps/web/instrumentation.ts`) and runs every hour (`0 * * * *`).