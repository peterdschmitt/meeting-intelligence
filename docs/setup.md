# Setup

## Calendar feeds (today's meetings prep)

The "Today's Meetings" panel and `/today` route are populated by a 3×/day cron
that ingests three ICS calendar feeds. Set these env vars (in `.env.local`
locally and in Vercel project settings for prod):

- `ICS_FEED_CONVERSELY` — ICS URL for the Conversely calendar
- `ICS_FEED_PINE_LAKE` — ICS URL for the Pine Lake Capital calendar
- `ICS_FEED_CRANBROOK` — ICS URL for the Cranbrook Analytics calendar

The cron job is gated by the existing `CRON_SECRET`. If any feed is unset, the
cron logs a warning and skips it; the others still run.
