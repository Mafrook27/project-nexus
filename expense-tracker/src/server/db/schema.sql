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
  created_at    timestamptz NOT NULL DEFAULT now()
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
