# Testing it yourself

Three ways, shortest first. None of them need an Android phone.

---

## 1. Check the parser in five seconds

No database, no server, no sign-in. From `expense-tracker/`:

```bash
npm install
npm run parse -- --sender AD-IPPBNK "Dear Customer, your IPPB A/c XXXX1234 is debited with Rs.500.00 on 20-09-2026 and credited to swiggy@ybl. UPI Ref no 528312345678. -IPPB"
```

```
  → money out 500
     bank      India Post Payments Bank
     paid to   Swiggy
     method    upi
     account   1234
     reference 528312345678
     certainty 95%
```

Paste a **real** message from IPPB, CUB, SBI or IOB and see what it makes of
it. A one-time password should print:

```
  → rejected (not a transaction: a code, a balance, a promo, or not yet)
```

A whole file of messages works too:

```bash
cat my-messages.txt | npm run parse
```

Run the test suite the same way — 139 tests, no setup:

```bash
npm test
```

---

## 2. Run the whole app locally

You need **Node 20+** and a MongoDB connection string. A free
[Atlas M0](https://www.mongodb.com/cloud/atlas) cluster is the easiest: sign up,
create an M0 cluster, add a database user, allow your IP under Network Access,
then **Connect → Drivers** and copy the string.

```bash
cd expense-tracker
npm install
npm run setup
```

`npm run setup` asks where the data should live (Atlas, a local `mongod`, or
Docker), proves the connection works before writing anything, generates the auth
secret itself, creates the indexes and offers to load a year of demo data.
Re-running it is safe. If your Atlas string has no database name on the end, it
appends `/paisa` for you — without one everything would land in a database
called `test`.

Then:

```bash
npm run dev           # http://localhost:3000
```

Doing it by hand instead: copy `.env.example` to `.env.local`, set `MONGODB_URI`
and `AUTH_SECRET`, then `npm run db:migrate && npm run db:seed`.

Sign in with **demo@paisa.app / demo1234**.

### Prefer MongoDB on your own machine?

Run it as a **single-node replica set**, not a bare `mongod`. Two features the
app relies on — multi-document transactions and change-safe batch writes — do
not exist on a standalone server. The app falls back to sequential writes if it
has to, but you will not be testing what production does.

```bash
# macOS
brew tap mongodb/brew
brew install mongodb-community@8.0
mongod --dbpath ~/mongo-data --replSet rs0 --port 27017 &
mongosh --eval 'rs.initiate()'
# then: MONGODB_URI="mongodb://localhost:27017/paisa?replicaSet=rs0&directConnection=true"
```

```bash
# Docker, if you have it
docker run -d --name paisa-db -p 27017:27017 mongo:8 --replSet rs0
docker exec paisa-db mongosh --eval 'rs.initiate()'
# then: MONGODB_URI="mongodb://localhost:27017/paisa?replicaSet=rs0&directConnection=true"
```

### The database self-check

Whichever database you picked, prove it actually works before trusting it:

```bash
npm run db:check
```

It connects, reports whether you are on a replica set, creates the indexes and
then checks the things that would quietly corrupt your data if they were wrong:

| It checks | Why it matters |
|---|---|
| Every unique index exists **and is unique** | An index created without `unique: true` looks fine and enforces nothing |
| A duplicate bank reference is rejected (error 11000) | This is what makes "the same SMS twice can never become two spends" a guarantee rather than a hope |
| `0.1 + 0.2` sums to exactly `0.3` | Money stored as a float would drift; this proves the rounding holds |
| A `$lookup` returns joined rows | The dashboard is built almost entirely out of these |
| A failed transaction rolls back | On a standalone server it says so instead of failing |

Everything it writes is namespaced to a throwaway user id and deleted at the
end, so it is safe to run against your real database.

A clean run ends with `all checks passed`. Anything else prints the exact
failure and exits non-zero.

---

## 3. Test the automatic capture, in the browser

Go to **Settings → Connected phones → Test a message**, or straight to
`/sms-test`.

Paste a real bank SMS. The result updates as you type, because the parser runs
in the browser — nothing is sent anywhere until you press the button.

- **"Send it through for real"** posts it to the same `/api/transactions/sync`
  endpoint the Android app will use. Watch it appear in **Needs a look**.
- Press it **twice with the same message** to watch deduplication reject the
  second one.
- Answer the spend in Needs a look, tick **"always sort this way"**, then send
  another message from the same shop. It should skip the queue entirely.
- Try the samples at the bottom of the page. The last four **must** be
  rejected; if one of them creates a spend, that is a bug worth reporting.

### The same thing with curl

Pair a phone in Settings, copy the token it shows once, then:

```bash
curl -X POST http://localhost:3000/api/transactions/sync \
  -H "Authorization: Bearer paisa_dev_xxx.yyy" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "sms",
    "sender": "AD-CITYUB",
    "message": "Your A/c XX4321 is debited by Rs.350.00 on 20-09-26 towards UPI/528399887766/ABC STORE -City Union Bank"
  }'
```

```json
{"results":[{"status":"created","id":"…","needsReview":true}],
 "created":1,"duplicates":0,"skipped":0,"needsReview":1}
```

Send it again and `created` becomes 0, `duplicates` becomes 1.

---

## What to look at once it is running

| Screen | What to check |
|---|---|
| Dashboard | Cash flow adds up, the wasted card matches what you marked |
| Needs a look | Answering a spend removes it and the badge count drops |
| Money in & out | Filters, search, edit, CSV import with `samples/bank-statement-sample.csv` |
| Stocks | Upload `samples/holdings-sample.csv`, then re-upload to refresh prices |
| FIRE | Drag the sliders; the date and the chart move together |
| Settings | Pair a phone, then revoke it. Rules appear after you teach one |
| Phone | Open it on your phone's browser and add it to your home screen |

---

## When something parses wrong

The fix is usually one line. Send the message verbatim, with its sender id, and
say what it should have read. Each bank's patterns live in one small file:

```
src/features/transactions/parsers/ippb.ts
src/features/transactions/parsers/cub.ts
src/features/transactions/parsers/sbi.ts
src/features/transactions/parsers/iob.ts
```

Add a case to `my-banks.test.ts` first — that file is deliberately weighted
toward messages that must be **rejected**, because a one-time password turned
into a ₹5,000 spend is far worse than a spend you have to add by hand.
