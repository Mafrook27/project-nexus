# Architecture

Notes for the next person to open this codebase — probably you, in six months.

---

## The shape of it

One Next.js app on the App Router. React Server Components render the shell and
check the session; the pages themselves are client components that talk to this
app's own `/api` routes. Postgres holds everything.

```
browser ──▶ src/proxy.ts            cookie present? if not, /login
        ──▶ src/app/(app)/layout    verifies the JWT signature for real
        ──▶ page (client component) fetches /api/…
              └─▶ src/app/api/…     route handler
                    └─▶ features/x/service.ts   SQL
                          └─▶ server/db/client  pooled pg
```

There is no separate API server, no ORM and no state-management library. For an
app this size each of those would cost more than it returns.

---

## Why feature folders

The alternative — `components/`, `hooks/`, `types/`, `api/` at the top level —
means one change to "how investments work" touches four directories and you have
to hold the whole app in your head to find anything.

Here, `features/investments/` contains the validation, the types, the SQL, the
REST config and the screens. Deleting the feature means deleting the folder.

Each feature folder uses the same five names:

| File | Runs where | Holds |
|---|---|---|
| `schema.ts` | both | zod validation and the row's TypeScript type |
| `crud.ts` | server | the table config for the generic REST factory |
| `service.ts` | server only | SQL that needs real logic (joins, aggregates) |
| `components/` | browser | the screens and dialogs |
| `calc.ts` / `math.ts` | both | pure functions, no React and no database |

Not every feature needs all five. `people/` is a schema and a crud config.
`fire/` is a schema, pure maths and one screen.

**The import rule:** features may import from `lib/`, `components/` and
`server/`. A feature should not reach into another feature's `components/`. When
it genuinely needs another feature's data — the dashboard needs account
balances — it imports that feature's `service.ts`, which is its public face.

---

## The CRUD factory

Nine of the tables are "a list of rows that belong to the signed-in user".
Writing four handlers nine times would be five hundred lines of code where
every line is a chance to forget `WHERE user_id = $1`.

Instead, `server/crud.ts` takes a table description:

```ts
export const goalsCrud: CrudConfig = {
  table: 'goals',
  columns: ['name', 'kind', 'target_amount', 'saved_amount', 'monthly_contribution', 'target_date'],
  createSchema: goalSchema,
  updateSchema: goalUpdateSchema,
  orderBy: 'target_date NULLS LAST, name',
};
```

and the route file is the whole endpoint:

```ts
export const { GET, POST } = collectionRoutes(goalsCrud);
```

Two properties make this safe:

- **`table` and `columns` are written in code**, never taken from a request. The
  only values that reach SQL from a client are bound parameters.
- **Every generated query carries `user_id`**, on reads and writes alike. There
  is one place to get that right rather than thirty-six.

Features that need more than this skip the factory. `transactions` has its own
route because filtering needs a dynamic `WHERE` clause; `dashboard` has a
service that runs thirteen queries in parallel.

---

## Data model

```
users ──┬── people ──────┬── accounts ──┐
        │                ├── investments├── transactions
        │                ├── sips       │
        │                └── liabilities│
        ├── categories ──┬── budgets    │
        │                └──────────────┘
        ├── recurring
        ├── goals
        └── net_worth_snapshots
```

Two decisions to know about:

**Balances are derived, never stored.** `accounts.opening_balance` plus the sum
of everything that has moved through the account. The SQL for it lives in
`features/accounts/service.ts` as `ACCOUNT_BALANCE_SQL` and is reused wherever a
balance is needed. Editing an old transaction therefore corrects every screen,
with no recalculation job to run and no chance of drifting out of sync.

**Net worth is snapshotted monthly.** Cash and investment values only tell you
about today; you cannot reconstruct what a mutual fund was worth last March. So
every dashboard load upserts one row into `net_worth_snapshots` for the current
month. The history builds itself as you use the app.

**`need_level` is on the transaction, not just the category.** A category
suggests a default (`categories.default_need_level`), but the same ₹400 at a
restaurant can be a planned dinner or a regretted one. The judgement belongs to
the individual spend, which is what makes the leaks card honest.

**`bucket` is on the transaction, not the category.** A category has a default
bucket, but groceries bought for the house and groceries bought for yourself are
genuinely different, and the split only works if you can override it per entry.

---

## The money type

Postgres returns `numeric` as a string to protect precision. Rather than
sprinkling `Number(...)` across every feature, `server/db/client.ts` registers a
type parser once, so `numeric` and `int8` arrive as JavaScript numbers.

This is safe here: `numeric(16,2)` up to a few crore is nowhere near
`Number.MAX_SAFE_INTEGER`. If this ever became a ledger for a business, the
right move would be integer paise and a decimal library — not float rupees.

Input goes the other way. `lib/validation.ts` runs every money field through
`parseAmount`, so the API accepts `1,250`, `₹1,20,000` and `12k`. Forms should
adapt to how people write, not the other way round.

---

## Auth

`jose` signs a JWT with `AUTH_SECRET`; it goes into an `httpOnly`,
`sameSite=lax` cookie for thirty days.

The check happens twice on purpose:

1. **`src/proxy.ts`** (what used to be called middleware) only asks whether a
   cookie exists. It runs on every navigation and must be fast; it cannot touch
   the database.
2. **`requireUser()`** in every API route and in `(app)/layout.tsx` verifies the
   signature properly.

So a forged cookie gets you the app shell, which then fails every data request
and bounces you to `/login`. The cheap check controls what you *see*; the real
check controls what you *get*.

---

## Charts

`lib/viz.ts` holds two palettes and one rule: **never add a ninth categorical
colour.** The eight in `SERIES` were validated against colour-vision-deficiency
simulation so that adjacent pairs stay distinguishable. A generated ninth hue
would collide with an existing one under CVD and break the whole set. When there
are more series than that, `foldTail()` keeps the top seven and folds the rest
into a grey "Other".

Where the data's job is *magnitude* rather than *identity* — which category cost
the most, which asset class is biggest — the chart uses the `SEQUENTIAL` blue
ramp and a ranked horizontal bar, not a pie. Long category names read better
horizontally, and ranked bars let you compare two similar values, which a pie
never does.

Three of the eight light-mode hues sit below 3:1 contrast on white. That is why
`ChartFrame` always renders a legend for two or more series and offers a table
view. No chart in this app encodes anything by colour alone.

---

## Adding a feature

Say you want to track insurance policies.

1. `src/features/insurance/schema.ts` — a zod schema and a `Policy` type.
2. Add the table to `src/server/db/schema.sql` with `user_id` and
   `ON DELETE CASCADE`, then `npm run db:migrate`.
3. `src/features/insurance/crud.ts` — the table config.
4. `src/app/api/insurance/route.ts` and `[id]/route.ts` — four lines each.
5. `src/features/insurance/components/InsuranceView.tsx` — the screen.
6. `src/app/(app)/insurance/page.tsx` — export the view.
7. Add it to `src/components/layout/nav.ts`.

If it needs a derived number on the dashboard, add a query to
`features/dashboard/service.ts` and a tile to `DashboardView`.

---

## What was deliberately left out

- **An ORM.** The queries here are short and the schema is stable. Raw SQL with
  bound parameters is easier to read than a query builder, and it is what you
  would paste into psql to debug anyway.
- **A data-fetching library.** `hooks/useResource.ts` is forty lines: fetch on
  mount, refetch on key change, `reload()` after a write. There is one server
  and no cross-tab cache to invalidate.
- **Dark mode.** Asked for and declined. One theme, tested properly.
- **Live market prices.** Stock values come from the CSV you upload. Adding a
  price feed means an API key, rate limits and a cron job; re-uploading a
  broker export takes ten seconds and is honest about when the data is from.
- **Real-time sync.** It is one person's money on one device at a time.
