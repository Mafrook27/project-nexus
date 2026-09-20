# Deploying Paisa

Everything here has a free tier. Total cost: ₹0.

The app is a single Next.js project, so "frontend" and "backend" deploy as one
thing. You need two services: somewhere to run the app, and a Postgres
database.

---

## Will it cost anything? No, and here is the arithmetic

Measured from a real database holding a seeded year of data, indexes included:

| | |
|---|---|
| One transaction, with every index | **1.7 KB** |
| A heavy year (40 spends a month) | **~0.8 MB** |
| Ten years | **~8 MB** |
| Whole database after ten years, Postgres overhead included | **~17 MB** |
| Neon's free tier | **512 MB** |

Ten years of tracking uses about **3%** of the free allowance. Storage is not
the thing that will ever push you onto a paid plan, so do not pick a database
on that basis.

What actually differs between the free tiers:

| | Storage | Expires? | Sleeps? | Card needed |
|---|---|---|---|---|
| **Neon** (recommended) | 0.5 GB | no | scales to zero, wakes in ~1s | no |
| **Supabase** | 0.5 GB | no | pauses after 7 idle days, manual resume | no |
| **Render Postgres** | 1 GB | **deleted after 30 days** | no | no |

Neon is the default here because it neither expires nor needs waking by hand.

---

## Step 1 — Create the database (Neon)

Neon's free tier does not expire and does not need a card.

1. Sign up at **https://neon.tech** and create a project.
   Pick the region closest to you — `ap-southeast-1` (Singapore) for India.
2. Name the database `paisa`.
3. Copy the **pooled** connection string. It looks like:

   ```
   postgresql://user:password@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/paisa?sslmode=require
   ```

   Use the **pooled** one (it has `-pooler` in the host). Serverless functions
   open and close connections constantly, and the pooler is what stops you from
   hitting the connection limit.

> Supabase and Render Postgres work too. Render's free database is deleted
> after 30 days, so prefer Neon or Supabase if you want to keep your history.

### Create the tables

The quickest path does all of this for you, including generating the auth
secret and testing the connection before it writes anything:

```bash
cd expense-tracker
npm install
npm run setup
```

If you would rather do it by hand, fill in `.env.local` and run:

```bash
npm run db:migrate
```

`schema.sql` is written with `IF NOT EXISTS` throughout, so running it again is
harmless. Run it once now and again whenever you pull schema changes.

---

## Step 2 — Deploy the app (Vercel)

1. Push this repository to GitHub.
2. At **https://vercel.com/new**, import it.
3. **Set the Root Directory to `expense-tracker`.** This repository holds more
   than one project, and Vercel needs to be told which folder to build. Without
   this the build fails immediately.
4. Framework preset: **Next.js** (it will detect this on its own).
5. Add the environment variables, for Production, Preview and Development:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the pooled Neon string from step 1 |
   | `AUTH_SECRET` | `openssl rand -base64 48` |
   | `ALLOWED_EMAILS` | *(optional)* your email, to stop strangers registering |

6. Deploy.

Check `https://your-app.vercel.app/api/health`. You want:

```json
{ "status": "ok", "checks": { "app": true, "database": true, "auth_secret": true } }
```

Then open the site, register your account, and add your first account under
**Accounts**.

`vercel.json` already pins the functions to the Mumbai region (`bom1`) and sets
sensible security headers. Change `regions` if you are not in India.

---

## Step 3 (optional) — Run it on Render instead

Some people would rather have a long-running server than serverless functions.
`render.yaml` is a blueprint that does exactly that.

1. At **https://dashboard.render.com**, choose **New → Blueprint** and pick this
   repository.
2. Render reads `render.yaml`, which already sets the root directory, the build
   and start commands, and `/api/health` as the health check.
3. It will prompt you for `DATABASE_URL`. Paste the Neon string.
   `AUTH_SECRET` is generated for you and kept across deploys.
4. Deploy.

**About the free plan:** a free Render web service sleeps after 15 minutes of no
traffic, and the next request takes roughly 30–50 seconds to wake it. That is
fine for a personal tracker you open a few times a day. If the wait annoys you,
the cheapest paid instance removes it, or use Vercel where nothing sleeps.

### Docker

`Dockerfile` builds the same app as a standalone image, for Fly.io, a VPS, or
anywhere else:

```bash
docker build -t paisa .
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://…" \
  -e AUTH_SECRET="…" \
  paisa
```

---

## Environment variables in full

| Name | Required | What it is |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string. TLS is required unless the host is localhost |
| `AUTH_SECRET` | yes | Signs the session cookie. At least 16 characters; 48 random bytes is right. Changing it signs everyone out |
| `ALLOWED_EMAILS` | no | Comma-separated allow-list for registration. Empty means anyone can sign up |
| `SEED_EMAIL` / `SEED_PASSWORD` | no | Credentials the seed script creates |
| `PG_POOL_MAX` | no | Connections per instance. Defaults to 5, which suits a free-tier database |
| `BUILD_STANDALONE` | no | Set to `true` for the Docker build. Vercel and Render do not need it |

---

## Installing it on your phone

The app is a PWA, so it installs from the browser with no app store involved.

- **Android / Chrome:** open the site, tap ⋮ → **Add to Home screen**.
- **iPhone / Safari:** open the site, tap Share → **Add to Home Screen**.

It then runs full screen with its own icon. The service worker caches the shell
so it opens instantly and shows a proper offline page rather than a browser
error — but it deliberately never caches your financial data, so figures on
screen are always live.

---

## Keeping it healthy

- **Backups.** Neon keeps point-in-time history on the free tier. For your own
  copy, Settings → Your data exports every transaction and investment as CSV.
- **Schema changes.** Pull, then `npm run db:migrate`. Nothing is destructive.
- **Starting over.** `npm run db:reset` drops every table and rebuilds them.
  It deletes everything — there is no undo.
- **Costs.** Watch Neon's storage if you import years of statements. A decade of
  one person's transactions is a few megabytes; the free 0.5 GB is not a real
  limit here.

---

## Troubleshooting

**Build fails on Vercel with "No Next.js version detected"**
The Root Directory is not set to `expense-tracker`. Fix it in Project Settings →
General.

**`/api/health` says `database: false`**
`DATABASE_URL` is missing, wrong, or lacks `?sslmode=require`. Check the value
in your host's environment settings, then redeploy — environment changes do not
apply to an already-running deployment.

**Every request returns 503 mentioning `AUTH_SECRET`**
The variable is unset or shorter than 16 characters.

**"relation \"users\" does not exist"**
You never ran `npm run db:migrate` against this database.

**Signed out constantly**
`AUTH_SECRET` is changing between deploys. On Render, make sure it is
`generateValue: true` (stored once) rather than something regenerated per build.

**Neon says "too many connections"**
You are using the direct connection string. Switch to the pooled one, or lower
`PG_POOL_MAX`.
