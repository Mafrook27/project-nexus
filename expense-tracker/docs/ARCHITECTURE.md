# Architecture

Notes for the next person to open this codebase — probably you, in six months.

This file is the *why*. For the *where* — diagrams of the request path, the data
model, and how a bank SMS becomes a sorted spend — see
**[CODE-MAP.md](CODE-MAP.md)**.

---

## The shape of it

One Next.js app on the App Router. React Server Components render the shell and
check the session; the pages themselves are client components that talk to this
app's own `/api` routes. MongoDB holds everything.

```
browser ──▶ src/proxy.ts            cookie present? if not, /login
        ──▶ src/app/(app)/layout    verifies the JWT signature for real
        ──▶ page (client component) fetches /api/…
              └─▶ src/app/api/…     route handler
                    └─▶ features/x/service.ts   queries, pipelines
                          └─▶ server/db/mongo   pooled driver
```

There is no separate API server, no ORM and no state-management library. For an
app this size each of those would cost more than it returns.

---

## Why feature folders

The alternative — `components/`, `hooks/`, `types/`, `api/` at the top level —
means one change to "how investments work" touches four directories and you have
to hold the whole app in your head to find anything.

Here, `features/investments/` contains the validation, the types, the queries,
the REST config and the screens. Deleting the feature means deleting the folder.

Each feature folder uses the same five names:

| File | Runs where | Holds |
|---|---|---|
| `schema.ts` | both | zod validation and the row's TypeScript type |
| `crud.ts` | server | the collection config for the generic REST factory |
| `service.ts` | server only | queries that need real logic (lookups, aggregates) |
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

Nine of the collections are "a list of documents that belong to the signed-in
user". Writing four handlers nine times would be five hundred lines of code
where every line is a chance to forget `user_id`.

Instead, `server/crud.ts` takes a collection description:

```ts
export const goalsCrud: CrudConfig = {
  collection: 'goals',
  columns: ['name', 'kind', 'target_amount', 'saved_amount', 'monthly_contribution', 'target_date'],
  createSchema: goalSchema,
  updateSchema: goalUpdateSchema,
  sort: { target_date: 1, name: 1 },
};
```

and the route file is the whole endpoint:

```ts
export const { GET, POST } = collectionRoutes(goalsCrud);
```

Two properties make this safe:

- **`collection` and `columns` are written in code**, never taken from a
  request. A client cannot name a field the factory will write, so no request
  body can set `user_id` on a document or reach a collection it was not meant
  to.
- **Every generated query carries `user_id`**, on reads and writes alike — the
  filter is built by the factory, not passed in. There is one place to get that
  right rather than thirty-six.

Features that need more than this skip the factory. `transactions` has its own
route because filtering builds the match stage dynamically; `dashboard` runs
one `$facet` pipeline in place of nine separate reads.

### What replaced `ON DELETE CASCADE`

Postgres cleaned up after a delete in the engine. MongoDB has no foreign keys,
so the same rules live in one `CASCADES` map at the top of `server/crud.ts`:
deleting a person unsets `person_id` on five collections, deleting a category
unsets it on transactions and clears the budgets and merchant rules that pointed
at it.

Keeping them in one table-driven map rather than scattered through each
feature's delete handler is deliberate — a cascade you forget somewhere is an
orphaned row that shows up later as a blank name on a dashboard.

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
of everything that has moved through the account. The pipeline for it lives in
`features/accounts/pipelines.ts` as `accountMovementLookup()` — a correlated
`$lookup` that sums the movements for each account — and is reused wherever a
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

Postgres stored money as `numeric(16,2)` — exact decimal. MongoDB stores a
JavaScript number, which is a float, so `0.1 + 0.2` would drift if nothing
stopped it.

What stops it: `money()` in `server/db/mongo.ts` rounds every amount to two
decimals on the way in and after every sum, and `npm run db:check` asserts that
the round trip still produces exactly `0.3`. Rupees-and-paise up to a few crore
sit far inside the range a double represents exactly, so this holds.

If this ever became a ledger for a business, the right move would be integer
paise or `Decimal128` — not float rupees. For one person's spending it is not
worth the friction of a type that every chart and form would have to unwrap.

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

## Transaction intelligence

Automatically detected spends have their own write path, their own status
machine and their own security model. It is large enough to deserve its own
document: **docs/TRANSACTION-INTELLIGENCE.md**.

Two things to know from here. `features/transactions/parsers/` deliberately
imports nothing from React, Node or the database, so the Android companion can
use it unchanged. And every money query in the app filters
`status: { $ne: 'ignored' }` — a row the user rejected stays in the collection
for the audit trail but is not money.

## Loading states

`components/ui/Skeleton.tsx` holds the blocks (a stat, a chart, a row, a meter,
a table) and `components/skeletons/PageSkeletons.tsx` composes one per screen,
laid out like the screen it replaces.

Each is used in two places:

1. `src/app/(app)/<route>/loading.tsx` - Next.js renders it the moment you
   navigate, before the page component exists.
2. The view itself, as an **early return** while its first fetch is in flight.

The early return matters. Returning a partial skeleton below a header that has
already rendered means the tiles above it show `₹0` for a second, which is worse
than showing nothing - a wrong number reads as real. So the whole view waits.

The shimmer is one CSS sweep (`.skeleton` in `globals.css`) and it stops
entirely under `prefers-reduced-motion`.

## Adding a feature

Say you want to track insurance policies.

1. `src/features/insurance/schema.ts` — a zod schema and a `Policy` type.
2. Add the collection and its indexes to `src/server/db/indexes.ts` (always
   lead the key with `user_id`), add any cascade it needs to the `CASCADES` map
   in `src/server/crud.ts`, then `npm run db:migrate`.
3. `src/features/insurance/crud.ts` — the collection config.
4. `src/app/api/insurance/route.ts` and `[id]/route.ts` — four lines each.
5. `src/features/insurance/components/InsuranceView.tsx` — the screen.
6. `src/app/(app)/insurance/page.tsx` — export the view.
7. Add it to `src/components/layout/nav.ts`.
8. Add a skeleton to `PageSkeletons.tsx` and a `loading.tsx` for the route.

If it needs a derived number on the dashboard, add a query to
`features/dashboard/service.ts` and a tile to `DashboardView`.

---

## What was deliberately left out

- **Mongoose, and ODMs generally.** The official driver already speaks the
  query language, and the documents here are validated by zod before they are
  written — a second schema layer would be the same rules stated twice, free to
  disagree. What is in `server/crud.ts` is what you would paste into `mongosh`
  to debug anyway.
- **A data-fetching library.** `hooks/useResource.ts` is forty lines: fetch on
  mount, refetch on key change, `reload()` after a write. There is one server
  and no cross-tab cache to invalidate.
- **Dark mode.** Asked for and declined. One theme, tested properly.
- **Live market prices.** Stock values come from the CSV you upload. Adding a
  price feed means an API key, rate limits and a cron job; re-uploading a
  broker export takes ten seconds and is honest about when the data is from.
- **Real-time sync.** It is one person's money on one device at a time.
