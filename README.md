# Cut

Tell it what you ate. It works out the numbers and files them.

One chat box handles everything: food, training, weight, water and fasting. Type
`1.5 packet maggie with 2 cheese slices for my dinner` and it logs a dinner with
macros. Type `2 eggs this morning, then walked 40 min` and it logs a meal *and*
a workout. Snap a photo of a plate and it reads the plate.

## Stack

| Piece | Choice | Why |
|---|---|---|
| App | Next.js 16, React 19, Tailwind v4 | Frontend and API in one deploy |
| Database | Neon Postgres + Drizzle | Free tier, serverless pooling |
| Auth | Neon Auth (Managed Better Auth) | Real accounts, sessions, no hand-rolled crypto |
| Text AI | Groq `openai/gpt-oss-120b` | ~2s extraction, generous free tier |
| Vision + web search | Google Gemini | Reads meal photos, grounds branded nutrition facts |
| Photos | Cloudflare R2 | 10 GB free, no egress fees, WebP compressed |
| Email | Resend | Daily report, 3000/month free |

### Why two AI providers

Groq is about five times faster than Gemini for text extraction and its free
tier is far more generous, so it runs every plain-text log. Gemini is reserved
for the two things Groq cannot do: reading a photo, and Google Search grounding
for branded items like Maggi or a McDonald's burger. Grounding has its own small
daily quota, so it is requested only when the model says official figures would
actually change the answer, and a spent quota degrades the estimate rather than
failing the log.

## Running it

```bash
pnpm install
cp .env.example .env.local   # fill in the keys
pnpm db:push                 # create the tables
pnpm dev
```

Every key has a free tier:

- **Neon** at neon.tech, take the *pooled* connection string, and enable Auth for
  `NEON_AUTH_BASE_URL`
- **Groq** at console.groq.com/keys
- **Gemini** at aistudio.google.com/apikey
- **Resend** at resend.com/api-keys
- **Cloudflare R2** (optional, photos are analysed but not stored without it)

## Apple Health

Apple gives no server-side Health API, so the phone pushes instead. The **You**
tab walks through building a Shortcut that POSTs to `/api/health/ingest` with a
per-user token, and an automation runs it nightly. Every field is optional and
posting twice a day updates that day rather than duplicating it.

When a day has Apple Watch active energy, the calorie burn uses that measured
number instead of a guessed activity multiplier.

## Daily report

Vercel Cron hits `/api/cron/daily-report` once a day (see `vercel.json`) with
`Authorization: Bearer $CRON_SECRET`. It builds an HTML email per user in their
own timezone. A unique `(user, day)` row makes retries safe.

Set the cron time to suit your timezone: the default `30 15 * * *` is 9pm IST.

## Deploying

Push to Vercel, add the same env vars, and set `APP_URL` to the deployed URL so
report emails link back correctly.
