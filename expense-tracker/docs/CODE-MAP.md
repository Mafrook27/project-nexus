# Code map

Diagrams for reading this codebase. Start here, then go to the file the diagram
points at.

`ARCHITECTURE.md` explains *why* the code is shaped this way.
This file shows *where things are* and *what happens in what order*.

---

## Where to start reading

If you have fifteen minutes, read these five files in this order. They are the
spine; everything else hangs off them.

| # | File | Why it matters |
|---|---|---|
| 1 | `src/server/db/mongo.ts` | Every collection and document shape, in one file |
| 2 | `src/server/crud.ts` | How nine collections share four route handlers |
| 3 | `src/features/transactions/intelligence/sync.ts` | The most interesting logic in the app |
| 4 | `src/features/dashboard/pipelines.ts` | How nine queries became one `$facet` |
| 5 | `docs/ARCHITECTURE.md` | The reasoning behind all of the above |

---

## 1. The shape of the app

One Next.js project. No separate API server, no ORM, no state library.

```mermaid
flowchart TD
    B["Browser<br/>PWA, installable"]
    P["src/proxy.ts<br/>cookie present? if not, /login"]
    L["src/app/(app)/layout.tsx<br/>verifies the JWT signature"]
    PG["page.tsx<br/>client component"]
    API["src/app/api/**/route.ts<br/>route handler"]
    SVC["features/x/service.ts<br/>real logic"]
    PIPE["features/x/pipelines.ts<br/>pure, no connection"]
    DB["server/db/mongo.ts<br/>pooled driver"]
    M[("MongoDB")]

    B --> P --> L --> PG
    PG -->|"fetch /api/..."| API
    API --> SVC
    SVC --> PIPE
    SVC --> DB
    DB --> M

    style PIPE fill:#e8f4ea,stroke:#4a7c59
    style M fill:#e6eefc,stroke:#2a78d6
```

The green box is the part worth noticing: **pipelines are pure**. They build a
MongoDB aggregation array and touch nothing else, which is why they can be
unit-tested without a database (`src/server/db/pipelines.test.ts`).

---

## 2. A feature folder

Every feature uses the same five names. Learn them once and you can read any
folder in the app.

```mermaid
flowchart LR
    subgraph F["features/investments/"]
        S["schema.ts<br/>zod + TypeScript type"]
        C["crud.ts<br/>collection config"]
        SV["service.ts<br/>queries with real logic"]
        PL["pipelines.ts<br/>pure aggregation builders"]
        CO["components/<br/>the screens"]
    end

    S --> C
    S --> CO
    C --> SV
    PL --> SV
```

**The rule:** a file in `features/x/` may import from `lib/`, `components/` and
`server/`. Two feature folders must not reach into each other's internals —
where they genuinely must, they import that feature's `service.ts`, which is
its public face.

---

## 3. The data model

14 collections. Every one carries `user_id`, and every generated query filters
on it.

```mermaid
erDiagram
    users ||--o{ people : owns
    users ||--o{ accounts : owns
    users ||--o{ categories : owns
    users ||--o{ transactions : owns
    users ||--o{ devices : "pairs"
    users ||--o{ merchant_rules : "learns"

    people ||--o{ accounts : "whose money"
    people ||--o{ investments : "whose holding"
    people ||--o{ sips : "whose SIP"
    people ||--o{ liabilities : "whose loan"

    accounts ||--o{ transactions : "moves through"
    categories ||--o{ transactions : "sorts"
    categories ||--o{ budgets : "caps"
    categories ||--o{ merchant_rules : "targets"
    investments ||--o{ sips : "funds"

    users ||--o{ goals : owns
    users ||--o{ recurring : owns
    users ||--o{ net_worth_snapshots : owns
```

Two things that surprise people:

- **Balances are never stored.** `accounts.opening_balance` plus a `$lookup`
  that sums everything that moved through the account. Editing a two-year-old
  transaction therefore corrects every screen, with no recalculation job.
- **MongoDB has no `ON DELETE CASCADE`.** The same rules live in a `CASCADES`
  map at the top of `src/server/crud.ts` — deleting a person unsets `person_id`
  across five collections, deleting a category clears its budgets and rules.

---

## 4. Transaction intelligence — the whole journey

This is the part worth understanding properly. A payment happens, and some
time later it appears on your dashboard, correctly sorted, without you typing
anything.

```mermaid
flowchart TD
    PAY["You pay ₹249 at a shop"]
    SMS["Bank sends an SMS"]
    AND["Android companion<br/>reads it, parses it locally"]
    POST["POST /api/transactions/sync<br/>Bearer paisa_dev_...."]
    ING["ingestEvent"]
    Q["Needs a look<br/>status: detected"]
    ANS["You answer once:<br/>what was it, and why"]
    RULE["merchant_rules<br/>'Swiggy is always Food'"]
    DASH["Dashboard<br/>status: categorized"]

    PAY --> SMS --> AND --> POST --> ING
    ING -->|"no rule yet"| Q
    Q --> ANS
    ANS -->|"tick 'always sort this way'"| RULE
    ANS --> DASH
    ING -->|"a rule already matches"| DASH
    RULE -.->|"next time, skips the queue"| ING

    style Q fill:#fdf3e2,stroke:#c98a24
    style DASH fill:#e8f4ea,stroke:#4a7c59
    style RULE fill:#e6eefc,stroke:#2a78d6
```

The dotted line is the point of the whole feature: **the queue should get
shorter over time.** Every answer you give teaches a rule, and a merchant with
a rule never reaches the queue again.

> The Android companion does not exist yet. Everything to the right of it is
> built and testable today — see `/sms-test` in the running app, which posts to
> the same endpoint.

---

## 5. `ingestEvent` — the decision tree

`src/features/transactions/intelligence/sync.ts`

This is the single most important function in the app, because it is the one
that can silently corrupt your data if it is wrong.

```mermaid
flowchart TD
    IN["SyncEvent arrives"]
    RES["resolve<br/>structured fields win,<br/>raw message fills the gaps"]
    AMT{"Is there an amount?"}
    SKIP["skipped<br/>'Not a transaction message'"]

    REF{"Does the bank<br/>reference already exist?"}
    DUP1["duplicate<br/>layer 1: exact"]

    WIN["Find rows within ±120s<br/>same amount, same type"]
    JUDGE{"pickDuplicate<br/>account agrees?<br/>merchant agrees?"}
    DUP2["duplicate<br/>layer 2: judgement<br/>+ backfill missing detail"]

    RULES["matchRule<br/>most specific wins"]
    ST{"statusFor<br/>auto_confirm AND<br/>confidence >= 0.5?"}
    CAT["status: categorized"]
    DET["status: detected<br/>goes to the queue"]

    INS["insertOne"]
    E11{"error 11000?"}
    DUP3["duplicate<br/>the unique index caught it"]
    OK["created"]

    IN --> RES --> AMT
    AMT -->|no| SKIP
    AMT -->|yes| REF
    REF -->|yes| DUP1
    REF -->|no| WIN --> JUDGE
    JUDGE -->|match| DUP2
    JUDGE -->|no match| RULES --> ST
    ST -->|yes| CAT --> INS
    ST -->|no| DET --> INS
    INS --> E11
    E11 -->|yes| DUP3
    E11 -->|no| OK

    style DUP1 fill:#fdf3e2,stroke:#c98a24
    style DUP2 fill:#fdf3e2,stroke:#c98a24
    style DUP3 fill:#fce8e8,stroke:#b3261e
    style OK fill:#e8f4ea,stroke:#4a7c59
```

### Why deduplication has two layers

They are genuinely different problems:

| | Layer 1 | Layer 2 |
|---|---|---|
| Problem | The same message twice | The same payment on a different channel |
| Cause | Android re-delivers, or a queue is flushed twice | One ₹500 payment fires a GPay notification *and* a bank SMS |
| Shared reference? | Yes — UPI RRN, NEFT UTR, card auth code | No |
| Method | Exact lookup. No guessing | Judgement: same amount and type, within 120s, account and merchant that do not contradict |
| Where | `sync.ts`, plus the unique index | `dedupe.ts` → `pickDuplicate`, pure and unit-tested |

**The red box matters.** Layer 1 is a *read* then a *write*, so two copies of
the same SMS arriving in the same millisecond can both pass the read. The
partial unique index on `(user_id, raw_reference)` is what actually makes the
guarantee hold — application code cannot promise this, a database constraint
can.

An absent merchant or account **agrees with anything**, because one channel
usually carries detail the other lacks. And when a duplicate is found the later
message is not thrown away: it backfills whatever `merchant`, `account_last4`
or `raw_reference` the first one was missing.

Erring toward "not a duplicate" is the safe direction. A rejected real purchase
is annoying; a phantom ₹500 on your dashboard is worse.

---

## 6. Status lifecycle

```mermaid
stateDiagram-v2
    [*] --> detected: from a phone, no rule matched
    [*] --> categorized: from a phone, a rule knew the merchant
    [*] --> confirmed: you typed it in yourself

    detected --> categorized: you answered what it was
    detected --> ignored: not yours, or not real
    categorized --> ignored: rejected later
    confirmed --> ignored: rejected later

    ignored --> [*]
```

`ignored` is not a delete. The row stays for the audit trail, and **every money
query in the app filters `status: { $ne: 'ignored' }`** — so a rejected row is
visible in history but is not money. If you add a new aggregate, that filter is
not optional.

---

## 7. Choosing a parser

`src/features/transactions/parsers/index.ts`

```mermaid
flowchart TD
    M["message + sender id"]
    S{"Is there a sender id?"}
    BY_S{"Does it match a<br/>bank's senderPattern?"}
    BY_B{"Does the body match<br/>a bank's bodyPattern?"}
    BANK["That bank's parser<br/>ippb / cub / sbi / iob /<br/>hdfc / icici / axis / kotak"]
    GEN["genericParser<br/>best-effort"]
    OUT{"Did it produce<br/>an amount?"}
    P["ParsedTransaction<br/>+ confidence"]
    NULL["null — an OTP, a balance,<br/>a promo, or not a transaction"]

    M --> S
    S -->|yes| BY_S
    S -->|no| BY_B
    BY_S -->|yes| BANK
    BY_S -->|no| BY_B
    BY_B -->|yes| BANK
    BY_B -->|no| GEN
    BANK --> OUT
    GEN --> OUT
    OUT -->|yes| P
    OUT -->|no| NULL

    style NULL fill:#fce8e8,stroke:#b3261e
```

The sender id decides when available — it is the only part of an SMS a bank
cannot get wrong.

**The red box is the important outcome.** `my-banks.test.ts` is deliberately
weighted toward messages that must be **rejected**, because a one-time password
turned into a ₹5,000 spend is far worse than a spend you have to add by hand.

These parsers import nothing from React, Node or the database. That is
deliberate: the Android companion will use them unchanged.

---

## 8. Pairing a phone

`src/features/devices/service.ts`

```mermaid
sequenceDiagram
    participant U as You, in Settings
    participant A as Next.js app
    participant D as devices collection
    participant P as Android phone

    U->>A: Pair a new phone
    A->>A: secret = randomBytes(32)
    A->>D: store SHA-256 of the secret only
    A-->>U: paisa_dev_ID.SECRET — shown once, never again
    U->>P: enter the token

    Note over P,A: later, for every batch

    P->>A: POST /api/transactions/sync, Bearer token
    A->>D: look up by id, check revoked_at
    A->>A: timing-safe compare of the hash
    A-->>P: created, duplicates, skipped, needsReview
```

The phone never holds your password. Only the hash is stored, so a database
dump cannot be replayed against the sync endpoint, and revoking a phone is one
field.

---

## 9. The dashboard in one pass

`src/features/dashboard/pipelines.ts`

Nine separate reads became one `$facet` over the same twelve months of rows.

```mermaid
flowchart LR
    MA["$match<br/>user, not ignored,<br/>last 12 months"]
    F{"$facet"}
    A["month"]
    B["prevMonth"]
    C["byCategory"]
    D["trend"]
    E["needSplit"]
    G["wasteCategories"]
    H["topMerchants"]
    I["needsAttention"]
    J["budgetSpend"]

    MA --> F
    F --> A & B & C & D & E & G & H & I & J
```

One scan of the collection instead of nine. Each branch is an ordinary
pipeline, and all of them are executed against fixtures in
`src/server/db/pipelines.test.ts`.

---

## 10. Which tests cover what

```
src/features/fire/calc.test.ts                        FIRE maths
src/features/calculators/math.test.ts                 SIP, lumpsum, EMI
src/features/import/csv.test.ts                       statement column detection
src/features/transactions/parsers/parsers.test.ts     the generic reader
src/features/transactions/parsers/my-banks.test.ts    IPPB, CUB, SBI, IOB
src/features/transactions/intelligence/*.test.ts      dedupe and rules
src/server/db/pipelines.test.ts                       the real aggregations
```

`npm test` runs all of them and needs no database.

`npm run db:check` is the other half, and does need one — it proves the
guarantees the unit tests cannot: that the unique index is genuinely unique,
that a duplicate bank reference is rejected with error 11000, that money sums
cleanly, and that a failed transaction rolls back.
