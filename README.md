# compressor-service-platform

## Required Environment Variables

- `CRON_SECRET` - secret key for protecting cron endpoint.
  - Example value for Railway Variables: `CRON_SECRET=any_secret_key`

## Automatic Moto-hour Updates

- Endpoint: `GET /api/cron/update-hours`
- Protection: pass one of:
  - query param `?secret=<CRON_SECRET>`
  - header `Authorization: Bearer <CRON_SECRET>`
  - header `x-cron-secret: <CRON_SECRET>`
- Formula used each hour for every equipment with configured mode:
  - `(hoursPerDay * daysPerWeek) / 7 / 24`
- Only equipment with both `hoursPerDay` and `daysPerWeek` set are updated.
- Each update is written to audit history with comment `Автоматическое обновление`.

### Scheduler options

- **Vercel Cron**: call `GET /api/cron/update-hours?secret=<CRON_SECRET>` hourly.
- **Railway**: configure an hourly cron call in `railway.toml`:

```toml
[cron.update-hours]
schedule = "0 * * * *"
command = "curl -fsS \"$RAILWAY_PUBLIC_DOMAIN/api/cron/update-hours?secret=$CRON_SECRET\""
```