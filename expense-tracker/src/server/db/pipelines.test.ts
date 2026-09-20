import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Aggregator } from 'mingo';
import type { Document } from 'mongodb';
import { accountsPipeline, cashTotalsPipeline } from '@/features/accounts/pipelines';
import { buildFilter, listTransactionsPipeline } from '@/features/transactions/pipelines';
import { portfolioPipeline } from '@/features/investments/pipelines';
import { dashboardFacet } from '@/features/dashboard/pipelines';

/**
 * These run the app's real aggregation pipelines against fixtures, using an
 * in-process implementation of MongoDB's aggregation operators.
 *
 * It is not a substitute for running against a live cluster, but it catches
 * the failure that matters most: a pipeline that returns the wrong number.
 * A dashboard that is merely slow is a nuisance; a dashboard that quietly
 * reports the wrong balance is worse than no dashboard.
 */

const U = 'user-1';

const run = (pipeline: Document[], input: Document[], collections: Record<string, Document[]> = {}) =>
  new Aggregator(pipeline, {
    collectionResolver: (name: string) => collections[name] ?? [],
  }).run(input) as Document[];

// --- fixtures --------------------------------------------------------------

const txn = (over: Partial<Document>): Document => ({
  _id: `t${Math.random()}`,
  user_id: U,
  account_id: null,
  to_account_id: null,
  category_id: null,
  person_id: null,
  type: 'expense',
  bucket: 'personal',
  need_level: 'need',
  amount: 100,
  txn_date: '2026-09-10',
  transaction_at: new Date('2026-09-10T12:00:00Z'),
  merchant: null,
  status: 'confirmed',
  source: 'manual',
  created_at: new Date('2026-09-10T12:00:00Z'),
  ...over,
});

const ACCOUNTS: Document[] = [
  { _id: 'a1', user_id: U, name: 'Salary', type: 'bank', opening_balance: 1000, is_emergency: false, archived: false, person_id: 'p1' },
  { _id: 'a2', user_id: U, name: 'Rainy day', type: 'bank', opening_balance: 5000, is_emergency: true, archived: false, person_id: 'p1' },
  { _id: 'a3', user_id: U, name: 'Credit card', type: 'credit_card', opening_balance: 0, is_emergency: false, archived: false, person_id: 'p1' },
  { _id: 'a4', user_id: U, name: 'Old account', type: 'bank', opening_balance: 999, is_emergency: false, archived: true, person_id: null },
];

const PEOPLE: Document[] = [{ _id: 'p1', user_id: U, name: 'Me', color: '#2a78d6' }];

const CATEGORIES: Document[] = [
  { _id: 'c1', user_id: U, name: 'Groceries', color: '#111', bucket: 'home', kind: 'expense' },
  { _id: 'c2', user_id: U, name: 'Dining', color: '#222', bucket: 'personal', kind: 'expense' },
];

describe('account balances', () => {
  const txns = [
    txn({ account_id: 'a1', type: 'expense', amount: 40 }),
    txn({ account_id: 'a1', type: 'income', amount: 100 }),
    txn({ account_id: 'a2', to_account_id: 'a1', type: 'transfer', amount: 25 }),
    txn({ account_id: 'a1', type: 'expense', amount: 999, status: 'ignored' }),
    txn({ account_id: 'a3', type: 'expense', amount: 300 }),
  ];

  it('folds every movement into the opening balance', () => {
    const rows = run(accountsPipeline(U), ACCOUNTS, { transactions: txns, people: PEOPLE });
    const byName = Object.fromEntries(rows.map((r) => [r.name, r.balance]));
    assert.equal(byName['Salary'], 1000 - 40 + 100 + 25);
    // The outgoing transfer leaves the source account.
    assert.equal(byName['Rainy day'], 5000 - 25);
    // A card spend makes the balance negative; that is what you owe.
    assert.equal(byName['Credit card'], -300);
  });

  it('never counts an ignored row', () => {
    const rows = run(accountsPipeline(U), ACCOUNTS, { transactions: txns, people: PEOPLE });
    const salary = rows.find((r) => r.name === 'Salary')!;
    assert.equal(salary.balance, 1085, 'the ignored ₹999 must not appear');
  });

  it('joins the owner name', () => {
    const rows = run(accountsPipeline(U), ACCOUNTS, { transactions: txns, people: PEOPLE });
    assert.equal(rows.find((r) => r.name === 'Salary')!.person_name, 'Me');
  });

  it('separates cash, the emergency slice and card dues', () => {
    const [totals] = run(cashTotalsPipeline(U), ACCOUNTS, {
      transactions: txns,
      people: PEOPLE,
    });
    // Archived accounts are excluded, so the 999 opening balance is not cash.
    assert.equal(totals.cash, 1085 + 4975);
    assert.equal(totals.emergency, 4975);
    assert.equal(totals.cardDues, 300);
  });

  it('reports no dues when a card is paid off', () => {
    const [totals] = run(cashTotalsPipeline(U), ACCOUNTS, {
      transactions: [txn({ account_id: 'a3', type: 'income', amount: 50 })],
      people: PEOPLE,
    });
    assert.equal(totals.cardDues, 0);
  });
});

describe('the transaction filter', () => {
  it('always excludes ignored rows', () => {
    const f = buildFilter(U, { limit: 50, offset: 0 } as never) as Record<string, unknown>;
    assert.deepEqual(f.status, { $ne: 'ignored' });
    assert.equal(f.user_id, U);
  });

  it('turns a month into a date range', () => {
    const f = buildFilter(U, { month: '2026-09', limit: 50, offset: 0 } as never) as Record<
      string,
      { $gte: string; $lte: string }
    >;
    assert.equal(f.txn_date.$gte, '2026-09-01');
    assert.equal(f.txn_date.$lte, '2026-09-30');
  });

  it('matches an account on either side of a transfer', () => {
    const f = buildFilter(U, { account_id: 'a1', limit: 50, offset: 0 } as never) as Record<
      string,
      unknown
    >;
    assert.deepEqual(f.$or, [{ account_id: 'a1' }, { to_account_id: 'a1' }]);
  });

  it('escapes a search term so it cannot act as a pattern', () => {
    const f = buildFilter(U, { q: 'a.b(c', limit: 50, offset: 0 } as never) as {
      $and: { $or: { merchant?: { $regex: string } }[] }[];
    };
    assert.equal(f.$and[0].$or[0].merchant!.$regex, 'a\\.b\\(c');
  });

  it('pages and totals in one pass', () => {
    const txns = [
      txn({ type: 'income', amount: 1000, txn_date: '2026-09-01' }),
      txn({ type: 'expense', amount: 300, txn_date: '2026-09-02', category_id: 'c1' }),
      txn({ type: 'expense', amount: 200, txn_date: '2026-09-03' }),
      txn({ type: 'expense', amount: 500, txn_date: '2026-08-15' }),
      txn({ type: 'expense', amount: 777, txn_date: '2026-09-04', status: 'ignored' }),
    ];
    const [result] = run(
      listTransactionsPipeline(U, { month: '2026-09', limit: 2, offset: 0 } as never),
      txns,
      { categories: CATEGORIES, accounts: ACCOUNTS, people: PEOPLE },
    );
    // Totals cover the whole month, not just the page.
    assert.equal(result.totals[0].count, 3);
    assert.equal(result.totals[0].income, 1000);
    assert.equal(result.totals[0].expense, 500);
    // The page is limited and newest first.
    assert.equal(result.rows.length, 2);
    assert.equal(result.rows[0].txn_date, '2026-09-03');
    // The joined category name is there for the UI.
    assert.equal(result.rows[1].category_name, 'Groceries');
  });
});

describe('the portfolio summary', () => {
  const holdings: Document[] = [
    { _id: 'i1', user_id: U, type: 'stock', invested: 1000, current_value: 1500, liquid: true, person_id: 'p1' },
    { _id: 'i2', user_id: U, type: 'stock', invested: 500, current_value: 400, liquid: true, person_id: 'p1' },
    { _id: 'i3', user_id: U, type: 'ppf', invested: 2000, current_value: 2200, liquid: false, person_id: null },
  ];

  it('totals, and keeps locked money out of the liquid figure', () => {
    const [r] = run(portfolioPipeline(U), holdings, { people: PEOPLE });
    assert.equal(r.totals[0].invested, 3500);
    assert.equal(r.totals[0].current, 4100);
    assert.equal(r.totals[0].liquid, 1900, 'PPF is locked, so it is not usable now');
  });

  it('groups by asset type, biggest first', () => {
    const [r] = run(portfolioPipeline(U), holdings, { people: PEOPLE });
    // PPF holds 2,200; the two stocks together hold 1,900. Biggest leads.
    assert.equal(r.byType[0].type, 'ppf');
    assert.equal(r.byType[0].current, 2200);
    assert.equal(r.byType[1].type, 'stock');
    assert.equal(r.byType[1].current, 1900, 'both stock rows fold into one');
  });

  it('labels unassigned holdings rather than dropping them', () => {
    const [r] = run(portfolioPipeline(U), holdings, { people: PEOPLE });
    const names = r.byPerson.map((p: Document) => p.name);
    assert.ok(names.includes('Me'));
    assert.ok(names.includes('Unassigned'));
  });
});

describe('the dashboard', () => {
  const range = {
    start: '2026-09-01',
    end: '2026-09-30',
    prevStart: '2026-08-01',
    prevEnd: '2026-08-31',
    trendStart: '2025-10-01',
  };

  const txns = [
    txn({ type: 'income', amount: 150000, txn_date: '2026-09-01' }),
    txn({ type: 'expense', amount: 32000, txn_date: '2026-09-02', bucket: 'home', category_id: 'c1', need_level: 'need', merchant: 'Landlord' }),
    txn({ type: 'expense', amount: 4000, txn_date: '2026-09-03', bucket: 'personal', category_id: 'c2', need_level: 'want', merchant: 'Swiggy' }),
    txn({ type: 'expense', amount: 1000, txn_date: '2026-09-04', bucket: 'personal', category_id: 'c2', need_level: 'waste', merchant: 'Swiggy' }),
    txn({ type: 'transfer', amount: 20000, txn_date: '2026-09-05' }),
    txn({ type: 'expense', amount: 9999, txn_date: '2026-09-06', status: 'ignored' }),
    txn({ type: 'expense', amount: 5000, txn_date: '2026-08-10', bucket: 'home' }),
    txn({ type: 'income', amount: 140000, txn_date: '2026-08-01' }),
    txn({ status: 'detected', amount: 1250, txn_date: '2026-09-07', merchant: 'Amazon', source: 'sms' }),
  ];

  const facet = () =>
    run(dashboardFacet(U, range), txns, { categories: CATEGORIES })[0];

  it('gets this month right, and ignores the ignored', () => {
    const m = facet().month[0];
    assert.equal(m.income, 150000);
    assert.equal(m.expense, 32000 + 4000 + 1000 + 1250, 'the detected spend counts, the ignored one does not');
    assert.equal(m.home, 32000);
    assert.equal(m.personal, 5000 + 1250);
    assert.equal(m.invested, 20000, 'a transfer is money moved to savings');
  });

  it('gets last month right, for the comparison', () => {
    const p = facet().prevMonth[0];
    assert.equal(p.income, 140000);
    assert.equal(p.expense, 5000);
  });

  it('splits spending by whether it was worth it', () => {
    const split = Object.fromEntries(
      facet().needSplit.map((r: Document) => [r.need_level, r.amount]),
    );
    assert.equal(split.want, 4000);
    assert.equal(split.waste, 1000);
    assert.equal(split.need, 32000 + 1250);
  });

  it('names the biggest leak', () => {
    const leaks = facet().wasteCategories;
    assert.equal(leaks[0].name, 'Dining');
    assert.equal(leaks[0].amount, 1000);
    assert.equal(leaks[0].n, 1);
  });

  it('ranks categories by spend, with names joined in', () => {
    const cats = facet().byCategory;
    assert.equal(cats[0].name, 'Groceries');
    assert.equal(cats[0].amount, 32000);
    assert.equal(cats[0].bucket, 'home');
  });

  it('builds the twelve-month trend by month', () => {
    const trend = facet().trend;
    const sept = trend.find((t: Document) => t.month === '2026-09')!;
    const aug = trend.find((t: Document) => t.month === '2026-08')!;
    assert.equal(sept.income, 150000);
    assert.equal(aug.expense, 5000);
    assert.equal(sept.waste, 1000);
  });

  it('adds up merchants', () => {
    const top = facet().topMerchants;
    const swiggy = top.find((m: Document) => m.merchant === 'Swiggy')!;
    assert.equal(swiggy.amount, 5000);
    assert.equal(swiggy.n, 2);
  });

  it('surfaces what still needs an answer', () => {
    const waiting = facet().needsAttention;
    assert.equal(waiting.length, 1);
    assert.equal(waiting[0].merchant, 'Amazon');
  });

  it('totals budget spend per category', () => {
    const spend = Object.fromEntries(
      facet().budgetSpend.map((b: Document) => [b._id, b.spent]),
    );
    assert.equal(spend.c1, 32000);
    assert.equal(spend.c2, 5000);
  });
});
