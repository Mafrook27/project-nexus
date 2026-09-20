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

Run the test suite the same way — 117 tests, no setup:

```bash
npm test
```

---

## 2. Run the whole app locally

You need **Node 20+** and a Postgres connection string. The free
[Neon](https://neon.tech) tier is the easiest: sign up, create a project, copy
the **pooled** connection string.

```bash
cd expense-tracker
npm install

cp .env.example .env.local
```

Fill in two values in `.env.local`:

```
DATABASE_URL="postgresql://…?sslmode=require"
AUTH_SECRET="paste the output of: openssl rand -base64 48"
```

Then:

```bash
npm run db:migrate    # create the tables
npm run db:seed       # a year of demo data + 3 spends waiting for review
npm run dev           # http://localhost:3000
```

Sign in with **demo@paisa.app / demo1234**.

### Prefer Postgres on your own machine?

```bash
# macOS
brew install postgresql@16 && brew services start postgresql@16
createdb paisa
# then: DATABASE_URL="postgresql://localhost:5432/paisa"
```

```bash
# Docker, if you have it
docker run -d --name paisa-db -e POSTGRES_PASSWORD=paisa -p 5432:5432 postgres:16
# then: DATABASE_URL="postgresql://postgres:paisa@localhost:5432/postgres"
```

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
