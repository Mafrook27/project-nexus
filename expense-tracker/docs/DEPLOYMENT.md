# Deploying Paisa

Everything here has a free tier. Total cost: ₹0.

The app is a single Next.js project, so "frontend" and "backend" deploy as one
thing. You need two services: somewhere to run the app, and a MongoDB database.

---

## Will it cost anything? No, and here is the arithmetic

One transaction, stored with every field the SMS parser fills in — merchant,
note, the raw bank message, the bank reference — measures **763 bytes** as
BSON. Its entries in the eight indexes add roughly **350 bytes**. Call it
**1.1 KB** per transaction before compression; MongoDB compresses collections
with snappy on disk, so the real figure is lower.

| | |
|---|---|
| One transaction, indexes included | **~1.1 KB** |
| A heavy year (40 spends a month) | **~0.5 MB** |
| Ten years | **~5 MB** |
| Atlas M0 free tier | **512 MB** |

Ten years of tracking uses about **1%** of the free allowance. Storage is not
the thing that will ever push you onto a paid plan.

What actually differs between the free tiers:

| | Storage | Expires? | Sleeps? | Card needed |
|---|---|---|---|---|
| **MongoDB Atlas M0** (recommended) | 0.5 GB | no | no | no |
| **Atlas on Azure/GCP** | 0.5 GB | no | no | no |

Atlas M0 is the default here: it does not expire, does not need a card, and
does not pause after idle days. Its one real limit is 500 connections, and this
app opens ten.

---

## Step 1 — Create the database (MongoDB Atlas)

1. Sign up at **https://www.mongodb.com/cloud/atlas** and create a project.
2. **Build a Database → M0 (Free)**. Pick the region closest to you —
   Mumbai (`ap-south-1`) for India.
3. **Database Access → Add New Database User.** Give it a long random password
   and the **Read and write to any database** role. Write the password down;
   Atlas will not show it again.
4. **Network Access → Add IP Address.** Vercel and Render have no static
   outbound IP on their free plans, so choose **Allow access from anywhere**
   (`0.0.0.0/0`). That is safe only because your database user has a long
   random password — Atlas still refuses anyone without it. If you self-host on
   a box with a fixed IP, allow-list that one instead.
5. **Connect → Drivers** and copy the connection string:

   ```
   mongodb+srv://user:password@cluster0.xxxxx.mongodb.net/paisa?retryWrites=true&w=majority
   ```

   **Add `/paisa` after the host**, as above. Atlas hands you the string without
   a database name, and without one every collection lands in a database called
   `test`.

### Create the indexes

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

MongoDB creates collections on first write, so there are no tables to build —
`db:migrate` creates the indexes. `createIndex` is idempotent, so running it
again is harmless. Run it once now and again whenever you pull changes.

Then prove the database actually works, end to end:

```bash
npm run db:check
```

It writes, reads, checks that the money arithmetic is exact, runs a `$lookup`,
rolls back a failed transaction, **and proves a duplicate bank reference is
rejected** — then deletes everything it wrote. See
[TESTING.md](TESTING.md#the-database-self-check) for what each line means.

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
   | `MONGODB_URI` | the Atlas string from step 1, with `/paisa` on the end |
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
3. It will prompt you for `MONGODB_URI`. Paste the Atlas string.
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
  -e MONGODB_URI="mongodb+srv://…/paisa" \
  -e AUTH_SECRET="…" \
  paisa
```

---

## Environment variables in full

| Name | Required | What it is |
|---|---|---|
| `MONGODB_URI` | yes | MongoDB connection string. Put the database name on the end, or everything lands in `test` |
| `AUTH_SECRET` | yes | Signs the session cookie. At least 16 characters; 48 random bytes is right. Changing it signs everyone out |
| `ALLOWED_EMAILS` | no | Comma-separated allow-list for registration. Empty means anyone can sign up |
| `SEED_EMAIL` / `SEED_PASSWORD` | no | Credentials the seed script creates |
| `MONGO_POOL_MAX` | no | Connections per instance. Defaults to 10; Atlas M0 allows 500 |
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

- **Backups.** Atlas M0 does **not** include automated backups — that starts at
  M10. So take your own: Settings → Your data exports every transaction and
  investment as CSV, and `mongodump --uri "$MONGODB_URI"` writes a full dump you
  can restore with `mongorestore`. Put that on a monthly reminder.
- **Index changes.** Pull, then `npm run db:migrate`. Nothing is destructive.
- **Starting over.** `npm run db:reset` drops every collection and recreates the
  indexes. It deletes everything — there is no undo.
- **Costs.** A decade of one person's transactions is a few megabytes; the free
  0.5 GB is not a real limit here.

---

## Troubleshooting

**Build fails on Vercel with "No Next.js version detected"**
The Root Directory is not set to `expense-tracker`. Fix it in Project Settings →
General.

**`/api/health` says `database: false`**
`MONGODB_URI` is missing or wrong, or Atlas is refusing the connection. Run
`npm run db:check` locally with the same string — it says which of the two it
is. Remember that environment changes do not apply to an already-running
deployment; redeploy after changing one.

**`MongoServerSelectionError: ... ETIMEDOUT` from Vercel or Render**
Network Access in Atlas does not allow the host. Add `0.0.0.0/0` (step 1.4).
This is the single most common cause.

**`bad auth : Authentication failed`**
The username or password in the URI is wrong, or the password contains
characters that need URL-encoding (`@`, `:`, `/`, `#` — percent-encode them).

**Every request returns 503 mentioning `AUTH_SECRET`**
The variable is unset or shorter than 16 characters.

**Your data is there but the app shows nothing**
The URI has no database name, so writes went to `test` and reads look in
`paisa` (or the reverse). Put `/paisa` before the `?` and redeploy.

**Signed out constantly**
`AUTH_SECRET` is changing between deploys. On Render, make sure it is
`generateValue: true` (stored once) rather than something regenerated per build.

**`Transaction numbers are only allowed on a replica set member or mongos`**
You are on a standalone `mongod`. Atlas is always a replica set, so this only
happens locally — the app falls back to sequential writes, but see
[TESTING.md](TESTING.md) for running a local single-node replica set instead.
