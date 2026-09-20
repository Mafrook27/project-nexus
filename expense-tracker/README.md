# Paisa

A personal money tracker: home and personal expenses, savings accounts, the
family's investments, SIPs, and one honest number for how far you are from
financial independence.

One Next.js app. The UI and the API live in the same codebase and deploy
together, so there is no separate backend to keep in sync.

```
IBM Plex · light theme only · installable as a PWA · built for a phone first
```

---

## What it does

| Area | What you get |
|---|---|
| **Dashboard** | Cash flow first: what came in, what you spent, what you saved, what is left. Then the money you wasted, where the rest went, budgets, bills due, net worth and freedom progress |
| **Money in & out** | Expense / income / transfer, tagged **home** or **personal**, by category, account and person. Filter by any of them, search, edit inline, export |
| **Automatic capture** | A paired phone turns bank SMS into spends by itself. Parsers for HDFC, ICICI, SBI, Axis and Kotak plus a generic fallback, two-layer deduplication so one payment never lands twice, and merchant rules so it stops asking about shops you have explained. See [docs/TRANSACTION-INTELLIGENCE.md](docs/TRANSACTION-INTELLIGENCE.md) |
| **Needs a look** | The queue of detected spends: what was it, was it worth it, why. Answer once and tick "always sort this way" and that merchant is never asked about again |
| **Was it worth it?** | Every spend is marked **must have**, **nice to have** or **wasted**. The dashboard then shows what you wasted this month, which categories leak the most, and what that money would become if you invested it instead |
| **CSV import** | Drop in a bank statement. Columns are auto-detected, Indian date formats are understood, and unknown categories are created for you |
| **Accounts** | Bank, cash, UPI wallet and credit card. Balances are computed from transactions, never typed in. Mark one account as your emergency fund |
| **Investments** | Mutual funds, stocks, FDs, RDs, PPF, EPF, NPS, gold, bonds, crypto, property — each owned by **you, your mother or your father**, with gains per person |
| **Stocks** | Upload your broker's holdings CSV and it charts itself: allocation, P&L per stock, best and worst, and a concentration warning |
| **SIPs** | Every recurring investment, with a blended expected return and a projection of where they land |
| **Budgets** | A monthly cap per category, either for every month or as a one-month override, with over-limit warnings |
| **Bills & EMIs** | Rent, subscriptions, insurance, loan instalments. One tap turns a due bill into a transaction and rolls the date forward |
| **Goals** | House deposit, a trip, your parents' medical buffer — each with a date and a monthly contribution |
| **FIRE** | Your FIRE number, Coast / Lean / Fat milestones, the age you get there, and a table of what each lever would change |
| **Calculators** | SIP (with yearly step-up), lumpsum, EMI with an amortisation table, and a goal planner |
| **Reports** | Twelve months of income against spending, savings-rate trend, home vs personal, every category, net worth over time |

Everything is multi-user and scoped by account, so nobody sees anybody else's
numbers.

---

## Quick start

You need **Node 20+** and a **PostgreSQL 14+** database. A free Neon or Supabase
database is plenty.

```bash
cd expense-tracker
npm install

cp .env.example .env.local     # then fill in DATABASE_URL and AUTH_SECRET
npm run db:migrate             # create the tables
npm run db:seed                # optional: a year of demo data

npm run dev                    # http://localhost:3000
```

Generate a secret with:

```bash
openssl rand -base64 48
```

If you seeded, sign in with `demo@paisa.app` / `demo1234`. Otherwise open
`/register` and create your own account.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm run start` | Production build and serve |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Unit tests for the finance maths and the CSV parser |
| `npm run db:migrate` | Apply `schema.sql` (safe to re-run) |
| `npm run db:reset` | Drop every table, then re-apply |
| `npm run db:seed` | Rebuild the demo account |

---

## Deploying

Short version: **Vercel for the app, Neon for the database.** Both have a free
tier that comfortably fits one person's money.

A Render blueprint (`render.yaml`) and a `Dockerfile` are included if you would
rather host it there. Full instructions, including the exact environment
variables and how to point a custom domain at it, are in
**[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

---

## How the code is organised

The codebase is **feature-based**: everything about one part of the product
lives in one folder, instead of being scattered across `controllers/`,
`models/` and `components/`.

```
src/
├─ app/                     Next.js routes only - thin files
│  ├─ (auth)/               login, register
│  ├─ (app)/                the signed-in shell and its pages
│  └─ api/                  REST endpoints, mostly 4 lines each
│
├─ features/                ← the real code lives here
│  ├─ devices/              phone pairing and device tokens
│  ├─ accounts/
│  │  ├─ schema.ts          zod validation + the row's TypeScript type
│  │  ├─ crud.ts            table config the generic REST factory consumes
│  │  ├─ service.ts         server-only SQL that needs real logic
│  │  └─ components/        the UI for this feature
│  ├─ transactions/
│  │  ├─ parsers/          bank SMS → structured spend (no React, no DB)
│  │  └─ intelligence/     dedupe, merchant rules, sync ingest
│  ├─ investments/
│  ├─ sips/
│  ├─ budgets/
│  ├─ recurring/
│  ├─ goals/
│  ├─ liabilities/
│  ├─ dashboard/
│  ├─ fire/                 calc.ts is pure maths, no React, no database
│  ├─ calculators/          math.ts likewise
│  ├─ import/               CSV parsing and the import dialog
│  ├─ people/
│  ├─ categories/
│  ├─ auth/
│  └─ settings/
│
├─ components/              shared and feature-agnostic
│  ├─ ui/                   Button, Card, Modal, Meter, StatTile, Table…
│  ├─ charts/               Recharts wrappers on one validated palette
│  └─ layout/               sidebar, mobile nav, app shell
│
├─ lib/                     money, dates, constants, fetch client, validation
├─ hooks/                   useResource, useAction
└─ server/                  db client, schema.sql, migrate, seed, crud factory
```

**The rule to remember:** a file in `features/x/` may import from `lib/`,
`components/` and `server/`, but two feature folders should not reach into each
other's internals. Where they genuinely must (the dashboard needs the accounts
balance SQL), they import that feature's `service.ts`, which is its public face.

`docs/ARCHITECTURE.md` walks through the request lifecycle, why the CRUD factory
exists, and how a new feature gets added in about fifteen minutes.

---

## The design decisions worth knowing

**One light theme, IBM Plex.** A money app gets read in daylight, on a phone,
often in a shop. One theme means one set of contrast values to get right. IBM
Plex Sans carries the words and IBM Plex Mono carries the numbers, so columns
of rupees line up exactly and a 7 never reads as a 1.

**Plain words, not finance words.** The app says "must have" instead of
"non-discretionary", "money you wasted" instead of "lifestyle inflation", and
"enough to pay you ₹52,700 a month without a job" instead of "corpus". Anyone
should be able to read a screen without a glossary.

**Balances are never stored.** An account balance is its opening balance plus
every transaction that has touched it. Edit a transaction from four months ago
and every number on every screen follows, because nothing was cached.

**Charts follow one validated palette.** The categorical colours in
`lib/viz.ts` were checked against colour-vision-deficiency simulation, so
adjacent series stay distinguishable. Three of them sit below the 3:1 contrast
line on white, which is why every chart also ships a legend, direct labels and
a table view. Nothing is ever encoded by colour alone.

**Loading looks like the page, not like a spinner.** Every screen has a
skeleton that traces its real layout - a stat tile skeleton is tile-sized, a
chart skeleton has an axis and gridlines. They run twice: Next.js shows one the
instant you tap a nav item, and the view shows the same one while its data
loads. Nothing shifts when the numbers arrive, and no screen ever flashes a
₹0 it is about to replace.

**Money is validated, not trusted.** The API accepts `1,250`, `₹1,20,000` and
`12k` because that is how people type, and it converts them server-side rather
than rejecting the form.

**The FIRE maths works in real terms.** The projection is inflation-adjusted, so
the target line stays flat in today's rupees and the chart tells you something
true instead of something flattering.

---

## Security notes

- Passwords are hashed with bcrypt. Login compares a hash even when the user
  does not exist, so timing does not leak which emails are registered.
- The session is a signed JWT in an `httpOnly`, `sameSite=lax` cookie.
- The proxy (`src/proxy.ts`) only checks that a cookie *exists*. Every API route
  and server component verifies the signature for real, so a forged cookie gets
  a signed-out app, not data.
- Every query filters on `user_id`. Table and column names in the CRUD factory
  come from code, never from a request.
- Set `ALLOWED_EMAILS` to lock registration to yourself once you are set up.

---

## Licence

Private project. Do what you like with it.
