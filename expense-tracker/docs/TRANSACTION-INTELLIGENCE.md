# Transaction intelligence

Phase 1: the server and the web app are ready for automatically detected
spends. No Android app exists yet, and none is needed to use or test any of
this — the same endpoint works from curl and from the browser.

The rule that shapes everything here: **the phone only detects, parses and
sends. Every decision about what a payment means happens on the server, and
every screen stays in the Next.js app.**

---

## What arrives, and what happens to it

```
bank SMS  ──►  companion app  ──►  POST /api/transactions/sync
                                            │
                                   1. parse (if raw)
                                   2. reject non-transactions
                                   3. deduplicate
                                   4. apply a learned rule
                                            │
                                            ▼
                              status = categorized   (sorted silently)
                                      or detected    (waits in Needs a look)
```

Nothing is ever dropped silently: a skipped message is reported back in the
response so the phone can log it.

---

## The sync endpoint

`POST /api/transactions/sync`

Authenticated by **a device token**, not your login. A browser session is also
accepted, which is what makes it testable from the web app.

```
Authorization: Bearer paisa_dev_<device-id>.<secret>
Content-Type: application/json
```

Send one event:

```json
{
  "source": "sms",
  "sender": "VM-HDFCBK",
  "message": "Sent Rs.450.00 From HDFC Bank A/C x1234 To Swiggy On 20/09/26 Ref 528312345678"
}
```

or, if the phone parsed it itself, the structured form:

```json
{
  "source": "sms",
  "amount": 450,
  "type": "debit",
  "merchant": "Swiggy",
  "paymentMethod": "upi",
  "bank": "HDFC Bank",
  "accountLast4": "1234",
  "reference": "528312345678",
  "transactionAt": "2026-09-20T13:10:00+05:30"
}
```

or a batch of up to 100, which is how a phone that has been offline catches up:

```json
{ "events": [ { … }, { … } ] }
```

Both forms may be mixed in one batch. Structured fields always win; the raw
message fills in whatever they leave out. Send at least an `amount` or a
`message`.

The response says what happened to every event, in order:

```json
{
  "results": [
    { "status": "created",   "id": "…", "needsReview": true },
    { "status": "duplicate", "id": "…" },
    { "status": "skipped",   "reason": "Not a transaction message" }
  ],
  "created": 1, "duplicates": 1, "skipped": 1, "needsReview": 1
}
```

A `duplicate` result is a success, not an error. The phone should mark the
message as handled and never retry it.

### The other endpoints

| Endpoint | Used by | What it does |
|---|---|---|
| `GET /api/transactions/review` | web | The queue, plus the shortlist of categories to show as chips |
| `POST /api/transactions/{id}/categorize` | web | Answers "what was this?", and optionally learns the merchant |
| `POST /api/transactions/{id}/reason` | web | Just the "why", when the category was already right |
| `PATCH /api/transactions/{id}` | web | `{"status":"ignored"}` drops it from every total |
| `GET POST /api/transaction-rules` | web | What the app has learned |
| `PATCH DELETE /api/transaction-rules/{id}` | web | Edit or forget a rule |
| `GET POST /api/devices` | web | Pair a phone; the token is returned once |
| `DELETE /api/devices/{id}` | web | Revoke a phone |

---

## Parsing

`src/features/transactions/parsers/` has no React, Node or database imports, so
**the Android app can import this folder as-is** rather than reimplementing it.

```
parsers/
├── types.ts     the shape every parser produces
├── helpers.ts   amount, account, reference, direction, date, merchant cleanup
├── generic.ts   the shared read + the fallback parser
├── ippb.ts      "debited ... and credited to <vpa>", "UPI Ref no"
├── cub.ts       "towards UPI/<rrn>/<payee>", "Card XX.. used for Rs.X at <m>"
├── sbi.ts       "by transfer to <payee> Ref No", "trf to <payee> Refno"
├── iob.ts       "by UPI Ref <rrn> to <payee>" - reference before the payee
├── hdfc.ts      "To <payee> On", and a YYYY-MM-DD:HH:MM:SS stamp
├── icici.ts     "Info: UPI/<rrn>/<payee>", "; <payee> credited"
├── axis.ts      "Info- UPI/P2M/<rrn>/<payee>"
├── kotak.ts     payee ends at a full stop, not a space
└── index.ts     parseBankMessage(message, sender?)
```

The first four are the banks actually in use. `my-banks.test.ts` covers them
against real-shaped messages, with more cases devoted to what must be
**rejected** than to what must be read.

Banks differ almost entirely in **where they put the payee**, so a bank parser
is the shared reader plus its own ordered list of merchant patterns. Two of
them also override a detail the shared reader gets wrong: HDFC's odd card
timestamp, and the fact that HDFC's UPI alert never contains the word "UPI".

The sender id picks the parser when it is available — it is the one part of an
SMS a bank cannot get wrong. Otherwise the body picks, and failing that the
generic reader has a go at lower confidence.

**What must never become a transaction** matters more than what must. A missed
spend is a gap you fill by hand; a one-time password turned into a ₹500 expense
is a wrong number you have to hunt down. Four families are rejected, each with
tests:

| Family | Examples that are rejected |
|---|---|
| Codes | "OTP", "One Time Password", "verification code", "secure code", "authentication code", "do not share", "valid for 10 mins", "123456 is your…" |
| Not yet, or not at all | "will be debited", "is due on", "declined", "insufficient balance", "e-mandate set up" |
| Marketing | "cashback", "offer valid", "apply now", "T&C apply", "pre-approved", "congratulations" |
| Balance only | a message with a balance and no debit or credit verb |

Almost every one of these quotes a rupee amount, and several use the word
"transaction" — which is exactly why keyword-spotting an amount is not enough.

### Confidence

Every parse carries a 0–1 score. Fields the phone sent are facts (0.9); fields
the parser inferred score by how much it recognised. Below 0.5 a merchant rule
is not allowed to auto-sort, because a guessed merchant is exactly the case
where a human should look.

---

## Deduplication

One ₹500 payment can produce a Google Pay notification, a bank SMS and a
bank-app push. None of them share a reference. Two layers, because these are
genuinely different problems:

**1. The same message twice.** Android re-delivers an SMS, or the phone flushes
a queue it already sent. The bank's own reference (UPI RRN, NEFT UTR, card auth
code) is unique, so a partial unique index on `(user_id, raw_reference)` settles
it with no guessing.

**2. The same payment on a different channel.** No shared reference, so this is
a judgement: same amount, same type, within **120 seconds**, on an account that
does not contradict, with a merchant that does not contradict. An absent
merchant or account agrees with anything, since one channel usually has detail
the other lacks.

When a duplicate is found the later message is not thrown away — it fills in
any `merchant`, `account_last4` or `raw_reference` the first one was missing.

Erring toward "not a duplicate" is the safe direction: a rejected real purchase
is annoying, but a phantom ₹500 in someone's dashboard is worse. Hence the short
window and the strict merchant check. `pickDuplicate` is pure and unit-tested.

---

## Learning

`merchant_rules` is how the app stops asking. Tick "always sort Swiggy this
way" in the review queue and a rule is written; the next Swiggy spend is
categorised on arrival with `needsReview: false`.

The most specific rule wins: exact beats contains, and a longer pattern beats a
shorter one — so a rule for "amazon prime video" is not swallowed by one for
"amazon". Rules count their hits, so Settings shows how many questions each one
has saved you.

An unticked rule pre-fills the answer but still asks, which is the right
behaviour for a merchant that could be two different things.

---

## Status, and what counts as money

| status | meaning | counts in totals |
|---|---|---|
| `detected` | arrived automatically, no human has looked | **yes** |
| `confirmed` | you entered it, or you confirmed it | yes |
| `categorized` | answered, or sorted by a rule | yes |
| `ignored` | not a real spend: a duplicate, a refund, a mistake | **no** |

`detected` counts on purpose. The money left the account whether or not you
have got round to labelling it, and a dashboard that hides it would be lying.
Only `ignored` is excluded, and every money query in the app filters it out.

---

## Security

- A phone gets **its own credential**, never your password. It can add
  transactions and do nothing else — it cannot read your dashboard, your
  balances or your investments.
- The token is shown **once**, at pairing. Only a SHA-256 hash is stored, so a
  database dump cannot be replayed against the sync endpoint.
- Comparison is constant-time, so the endpoint does not leak whether a prefix
  was right.
- Revoking is one `UPDATE`. The row stays, so you can still see what that phone
  synced and when.
- An SMS body is stored in `raw_message` only when the phone sends one, so a
  mis-parse can be diagnosed. Do not send messages you would not want stored.

---

## What Phase 2 has to build

The companion app is deliberately small:

1. Ask for `RECEIVE_SMS` / `READ_SMS`, or notification-listener access.
2. On each message, call `parseBankMessage(body, sender)` from this repo.
3. Queue the result locally; the phone is often offline when the SMS lands.
4. `POST /api/transactions/sync` with the device token, in batches.
5. Mark anything that comes back `created`, `duplicate` **or** `skipped` as
   handled. Only a network or 5xx error is worth retrying.

It needs no UI beyond pairing, a sync log, and a switch to turn it off.
