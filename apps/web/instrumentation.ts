import { runAutoHoursUpdate } from '@/lib/auto-hours'

let started = false

export async function register() {
  if (started) return
  started = true

  const isRailway = Boolean(process.env.RAILWAY_PROJECT_ID)
  if (!isRailway) return

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.warn('[auto-hours] CRON_SECRET is not set, scheduler disabled')
    return
  }

  const cron = await import('node-cron')
  cron.schedule('0 * * * *', async () => {
    try {
      const result = await runAutoHoursUpdate()
      if (!result.ok) {
        console.error('[auto-hours] Failed:', result.error)
        return
      }
      console.log(`[auto-hours] Updated: ${result.updated}, skipped: ${result.skipped}`)
    } catch (error) {
      console.error('[auto-hours] Unexpected error', error)
    }
  })

  console.log('[auto-hours] Hourly scheduler started on Railway')
}

