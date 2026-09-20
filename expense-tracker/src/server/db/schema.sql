-- ============================================================================
-- Paisa · schema (PostgreSQL 14+)
-- Every table is scoped by user_id so the whole app is multi-user from day one.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  name          text NOT NULL DEFAULT 'You',
  password_hash text NOT NULL,
  currency      text NOT NULL DEFAULT 'INR',
  settings      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Whose money is this: you, mother, father, family pot...
CREATE TABLE IF NOT EXISTS people (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  relation   text NOT NULL DEFAULT 'self',       -- self | mother | father | spouse | family | other
  color      text NOT NULL DEFAULT '#4f46e5',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  person_id       uuid REFERENCES people(id) ON DELETE SET NULL,
  name            text NOT NULL,
  type            text NOT NULL DEFAULT 'bank',  -- bank | cash | wallet | credit_card
  institution     text,
  opening_balance numeric(16,2) NOT NULL DEFAULT 0,
  -- Last four digits as the bank writes them, so an incoming SMS can be
  -- matched to the right account without you linking it by hand.
  last4         text,
  is_emergency    boolean NOT NULL DEFAULT false,
  archived        boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  kind       text NOT NULL DEFAULT 'expense',    -- expense | income
  bucket     text NOT NULL DEFAULT 'personal',   -- home | personal
  icon       text NOT NULL DEFAULT 'Circle',
  color      text NOT NULL DEFAULT '#64748b',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name, kind)
);

CREATE TABLE IF NOT EXISTS transactions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id    uuid REFERENCES accounts(id) ON DELETE SET NULL,
  to_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,  -- transfers only
  category_id   uuid REFERENCES categories(id) ON DELETE SET NULL,
  person_id     uuid REFERENCES people(id) ON DELETE SET NULL,
  type          text NOT NULL DEFAULT 'expense', -- expense | income | transfer
  bucket        text NOT NULL DEFAULT 'personal',-- home | personal
  amount        numeric(16,2) NOT NULL,
  txn_date      date NOT NULL DEFAULT CURRENT_DATE,
  merchant      text,
  note          text,
  -- Was this money well spent? need | want | waste
  need_level    text NOT NULL DEFAULT 'need',

  -- ---- Transaction intelligence -----------------------------------------
  -- Where the row came from. Anything not 'manual' arrived automatically and
  -- has not been looked at by a human yet.
  source        text NOT NULL DEFAULT 'manual',   -- manual | sms | notification | import
  status        text NOT NULL DEFAULT 'confirmed',-- detected | confirmed | categorized | ignored
  payment_method text NOT NULL DEFAULT 'unknown', -- upi | card | cash | bank_transfer | atm | unknown
  bank          text,
  account_last4 text,
  -- Precise instant, where txn_date is only the day. Dedup needs the seconds.
  transaction_at timestamptz,
  -- Why you spent it, in your own words.
  reason        text,
  -- The bank's own reference (UPI RRN, card auth code). Globally unique when
  -- present, which makes it the strongest duplicate signal there is.
  raw_reference text,
  -- The message the parser read, kept so a mis-parse can be diagnosed.
  raw_message   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tx_user_date_idx ON transactions (user_id, txn_date DESC);
CREATE INDEX IF NOT EXISTS tx_user_cat_idx  ON transactions (user_id, category_id);

CREATE TABLE IF NOT EXISTS budgets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  month       text NOT NULL,                     -- 'YYYY-MM', or 'default' for every month
  amount      numeric(16,2) NOT NULL,
  UNIQUE (user_id, category_id, month)
);

CREATE TABLE IF NOT EXISTS investments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  person_id     uuid REFERENCES people(id) ON DELETE SET NULL,
  name          text NOT NULL,
  type          text NOT NULL DEFAULT 'mutual_fund',
  -- mutual_fund | stock | fd | rd | ppf | epf | nps | gold | crypto | real_estate | bond | other
  symbol        text,
  units         numeric(20,6),
  avg_price     numeric(16,4),
  last_price    numeric(16,4),
  invested      numeric(16,2) NOT NULL DEFAULT 0,
  current_value numeric(16,2) NOT NULL DEFAULT 0,
  start_date    date,
  maturity_date date,
  liquid        boolean NOT NULL DEFAULT true,   -- counts toward the FIRE corpus
  notes         text,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inv_user_idx ON investments (user_id);

CREATE TABLE IF NOT EXISTS sips (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  person_id       uuid REFERENCES people(id) ON DELETE SET NULL,
  investment_id   uuid REFERENCES investments(id) ON DELETE SET NULL,
  name            text NOT NULL,
  amount          numeric(16,2) NOT NULL,
  day_of_month    int NOT NULL DEFAULT 1,
  expected_return numeric(6,2) NOT NULL DEFAULT 12,
  step_up_pct     numeric(6,2) NOT NULL DEFAULT 0,
  start_date      date NOT NULL DEFAULT CURRENT_DATE,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS liabilities (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  person_id     uuid REFERENCES people(id) ON DELETE SET NULL,
  name          text NOT NULL,
  type          text NOT NULL DEFAULT 'loan',    -- loan | credit_card | emi | other
  principal     numeric(16,2) NOT NULL DEFAULT 0,
  outstanding   numeric(16,2) NOT NULL DEFAULT 0,
  interest_rate numeric(6,2) NOT NULL DEFAULT 0,
  emi           numeric(16,2) NOT NULL DEFAULT 0,
  end_date      date,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recurring (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id  uuid REFERENCES accounts(id) ON DELETE SET NULL,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  name        text NOT NULL,
  amount      numeric(16,2) NOT NULL,
  type        text NOT NULL DEFAULT 'expense',
  bucket      text NOT NULL DEFAULT 'home',
  frequency   text NOT NULL DEFAULT 'monthly',   -- weekly | monthly | quarterly | yearly
  next_due    date NOT NULL,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS goals (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                 text NOT NULL,
  kind                 text NOT NULL DEFAULT 'custom', -- custom | emergency | purchase | education | retirement
  target_amount        numeric(16,2) NOT NULL,
  saved_amount         numeric(16,2) NOT NULL DEFAULT 0,
  monthly_contribution numeric(16,2) NOT NULL DEFAULT 0,
  target_date          date,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- A phone that is allowed to post transactions on your behalf. The plaintext
-- token is shown once at pairing and never stored.
CREATE TABLE IF NOT EXISTS devices (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         text NOT NULL,
  platform     text NOT NULL DEFAULT 'android',  -- android | ios | other
  token_hash   text NOT NULL,
  last_seen_at timestamptz,
  synced_count int NOT NULL DEFAULT 0,
  revoked_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS devices_user_idx ON devices (user_id);

-- "Swiggy is always Food." Learned from what you tell the review queue, so the
-- app stops asking about merchants you have already explained.
CREATE TABLE IF NOT EXISTS merchant_rules (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pattern      text NOT NULL,                    -- matched case-insensitively
  match_type   text NOT NULL DEFAULT 'contains', -- contains | exact
  category_id  uuid REFERENCES categories(id) ON DELETE CASCADE,
  bucket       text,
  need_level   text,
  -- true: categorise silently. false: still ask, but pre-fill the answer.
  auto_confirm boolean NOT NULL DEFAULT true,
  hits         int NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, pattern, match_type)
);
CREATE INDEX IF NOT EXISTS merchant_rules_user_idx ON merchant_rules (user_id);

-- One row per month, written by the app so the net-worth chart survives edits.
CREATE TABLE IF NOT EXISTS net_worth_snapshots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month       text NOT NULL,                     -- YYYY-MM
  cash        numeric(16,2) NOT NULL DEFAULT 0,
  investments numeric(16,2) NOT NULL DEFAULT 0,
  liabilities numeric(16,2) NOT NULL DEFAULT 0,
  net_worth   numeric(16,2) NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, month)
);


-- ---------------------------------------------------------------------------
-- Migrations for databases created by an earlier version of this file.
-- These run after the CREATE TABLE block, so a column an index depends on
-- always exists by the time the index is created. Each one is safe to re-run.
-- ---------------------------------------------------------------------------
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS need_level text NOT NULL DEFAULT 'need';
ALTER TABLE categories   ADD COLUMN IF NOT EXISTS default_need_level text NOT NULL DEFAULT 'need';

CREATE INDEX IF NOT EXISTS tx_user_need_idx ON transactions (user_id, need_level);

-- Transaction intelligence, for databases created before it existed.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS source         text NOT NULL DEFAULT 'manual';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS status         text NOT NULL DEFAULT 'confirmed';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'unknown';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS bank           text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS account_last4  text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transaction_at timestamptz;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reason         text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS raw_reference  text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS raw_message    text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS updated_at     timestamptz NOT NULL DEFAULT now();
ALTER TABLE accounts     ADD COLUMN IF NOT EXISTS last4          text;

-- Rows that pre-date the column have no precise time; midday keeps them inside
-- their own day in every timezone this app is likely to run in.
UPDATE transactions SET transaction_at = txn_date + time '12:00'
 WHERE transaction_at IS NULL;

-- The bank's reference is unique when the bank sends one, so the same SMS
-- arriving twice can never create two rows.
CREATE UNIQUE INDEX IF NOT EXISTS tx_user_reference_uniq
  ON transactions (user_id, raw_reference)
  WHERE raw_reference IS NOT NULL;

-- The review queue reads this constantly.
CREATE INDEX IF NOT EXISTS tx_user_status_idx ON transactions (user_id, status)
  WHERE status = 'detected';

-- Supports the cross-channel duplicate window scan.
CREATE INDEX IF NOT EXISTS tx_user_at_idx ON transactions (user_id, transaction_at DESC);
