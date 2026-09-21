/**
 * Fills a fresh database with a believable year of data so every screen has
 * something to show. Safe to re-run: it removes and rebuilds the seed user.
 *
 *   npm run db:seed
 */
import './env';
import bcrypt from 'bcryptjs';
import { DEFAULT_CATEGORIES, type NeedLevel } from '../../lib/constants';
import {
  accounts,
  budgets,
  categories,
  closeClient,
  goals,
  investments,
  liabilities,
  merchantRules,
  money,
  newId,
  people,
  recurring,
  sips,
  transactions,
  users,
  type TransactionDoc,
} from './mongo';
import { ensureIndexes } from './indexes';
import { deleteEverythingFor } from './wipe';

const EMAIL = process.env.SEED_EMAIL ?? 'demo@paisa.app';
const PASSWORD = process.env.SEED_PASSWORD ?? 'demo1234';
const NAME = process.env.SEED_NAME ?? 'Demo';

const rand = (min: number, max: number) => Math.round(min + Math.random() * (max - min));
const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];
const iso = (d: Date) => d.toISOString().slice(0, 10);
const now = new Date();

async function main() {
  console.log(`· seeding ${EMAIL}`);
  await ensureIndexes();

  const existing = await users().findOne({ email: EMAIL });
  if (existing) await deleteEverythingFor(existing._id);

  const userId = newId();
  await users().insertOne({
    _id: userId,
    email: EMAIL,
    name: NAME,
    password_hash: await bcrypt.hash(PASSWORD, 10),
    currency: 'INR',
    settings: {
      current_age: 29,
      retire_age: 48,
      monthly_expenses: 62000,
      monthly_investment: 55000,
      inflation: 6,
      pre_retirement_return: 12,
      post_retirement_return: 8,
      withdrawal_rate: 4,
      emergency_months: 6,
      expense_ratio_in_retirement: 85,
    },
    created_at: now,
  });

  // People -------------------------------------------------------------
  const me = newId();
  const mother = newId();
  const father = newId();
  await people().insertMany([
    { _id: me, user_id: userId, name: NAME, relation: 'self', color: '#2a78d6', created_at: now },
    { _id: mother, user_id: userId, name: 'Mother', relation: 'mother', color: '#eb6834', created_at: now },
    { _id: father, user_id: userId, name: 'Father', relation: 'father', color: '#1baf7a', created_at: now },
  ]);

  // Categories ---------------------------------------------------------
  const categoryDocs = DEFAULT_CATEGORIES.map((c) => ({
    _id: newId(),
    user_id: userId,
    name: c.name,
    kind: c.kind,
    bucket: c.bucket,
    default_need_level: c.need,
    icon: c.icon,
    color: c.color,
    created_at: now,
  }));
  await categories().insertMany(categoryDocs);
  const catBy = (name: string) => categoryDocs.find((c) => c.name === name)!._id;
  const expenseCats = categoryDocs.filter((c) => c.kind === 'expense');

  // Accounts -----------------------------------------------------------
  const acc = (
    name: string,
    type: string,
    institution: string | null,
    opening: number,
    emergency: boolean,
    owner: string,
    last4: string | null,
  ) => ({
    _id: newId(),
    user_id: userId,
    person_id: owner,
    name,
    type,
    institution,
    opening_balance: opening,
    last4,
    is_emergency: emergency,
    archived: false,
    created_at: now,
  });

  const salary = acc('HDFC Salary', 'bank', 'HDFC Bank', 85000, false, me, '1234');
  const savings = acc('ICICI Savings', 'bank', 'ICICI Bank', 420000, true, me, '4321');
  const cash = acc('Cash wallet', 'cash', null, 6000, false, me, null);
  const upi = acc('UPI / Paytm', 'wallet', 'Paytm', 3500, false, me, null);
  const card = acc('HDFC Regalia', 'credit_card', 'HDFC Bank', 0, false, me, '9012');
  const momAccount = acc('SBI Savings (Mom)', 'bank', 'SBI', 310000, false, mother, '5678');
  await accounts().insertMany([salary, savings, cash, upi, card, momAccount]);

  // Twelve months of transactions --------------------------------------
  const merchants: Record<string, string[]> = {
    Groceries: ['BigBasket', 'DMart', 'Local kirana', 'Zepto'],
    'Food & dining': ['Swiggy', 'Zomato', 'Third Wave Coffee', 'Local restaurant'],
    'Transport & fuel': ['Uber', 'HP Petrol', 'Metro card', 'Rapido'],
    Shopping: ['Amazon', 'Myntra', 'Decathlon'],
    Subscriptions: ['Netflix', 'Spotify', 'iCloud', 'Jio Fiber'],
    Utilities: ['BESCOM', 'Airtel', 'Gas agency'],
    Entertainment: ['PVR', 'BookMyShow'],
    Healthcare: ['Apollo Pharmacy', 'Practo'],
    'Personal care': ['Salon', 'Nykaa'],
    Travel: ['IRCTC', 'IndiGo', 'MakeMyTrip'],
    Education: ['Coursera', 'Tuition fees', 'Book depot'],
    'Gifts & donations': ['Gift shop', 'Temple donation', 'Birthday gift'],
    Insurance: ['HDFC Life', 'Star Health', 'Bajaj Allianz'],
    'Rent / EMI': ['Landlord'],
    'Household help': ['Help', 'Cook', 'Driver'],
    Misc: ['Sundry', 'Unplanned', 'Odds and ends'],
  };

  const docs: TransactionDoc[] = [];
  const txn = (over: Partial<TransactionDoc> & { amount: number; txn_date: string }) => {
    docs.push({
      _id: newId(),
      user_id: userId,
      account_id: salary._id,
      to_account_id: null,
      category_id: null,
      person_id: me,
      type: 'expense',
      bucket: 'personal',
      need_level: 'need',
      merchant: null,
      note: null,
      reason: null,
      source: 'manual',
      status: 'confirmed',
      payment_method: 'unknown',
      bank: null,
      account_last4: null,
      raw_reference: null,
      raw_message: null,
      created_at: now,
      updated_at: now,
      ...over,
      amount: money(over.amount),
      transaction_at: new Date(`${over.txn_date}T12:00:00`),
    } as TransactionDoc);
  };

  for (let back = 11; back >= 0; back--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
    const cap = back === 0 ? Math.min(now.getDate(), daysInMonth) : daysInMonth;
    const day = (d: number) => iso(new Date(monthDate.getFullYear(), monthDate.getMonth(), d));

    txn({
      type: 'income',
      category_id: catBy('Salary'),
      amount: 150000 + back * -800 + rand(-2000, 2000),
      txn_date: day(1),
      merchant: 'Monthly salary',
    });

    for (const [catName, amount, merchant] of [
      ['Rent / EMI', 32000, 'Landlord'],
      ['Utilities', rand(2200, 4200), pick(merchants.Utilities)],
      ['Household help', 4500, 'Help'],
      ['Insurance', 3200, 'HDFC Life'],
    ] as [string, number, string][]) {
      txn({
        bucket: 'home',
        category_id: catBy(catName),
        amount,
        txn_date: day(rand(2, 6)),
        merchant,
      });
    }

    for (let i = 0; i < rand(26, 40); i++) {
      const cat = pick(expenseCats);
      const names = merchants[cat.name] ?? [cat.name];
      const amount =
        cat.name === 'Groceries'
          ? rand(400, 3200)
          : cat.name === 'Travel'
            ? rand(2000, 18000)
            : cat.name === 'Education'
              ? rand(1500, 9000)
              : rand(90, 2400);
      // Roughly a fifth of "nice to have" spending is money you would take
      // back if you could, which is what the leaks card is for.
      const level: NeedLevel =
        cat.default_need_level === 'want' && Math.random() < 0.28
          ? 'waste'
          : (cat.default_need_level as NeedLevel);
      txn({
        account_id: pick([salary._id, upi._id, cash._id, card._id]),
        category_id: cat._id,
        bucket: cat.bucket,
        need_level: level,
        amount,
        txn_date: day(rand(1, cap)),
        merchant: pick(names),
      });
    }

    txn({
      type: 'transfer',
      account_id: salary._id,
      to_account_id: savings._id,
      amount: rand(20000, 45000),
      txn_date: day(Math.min(5, cap)),
      merchant: 'To savings',
    });
  }

  // A few spends "detected by the phone", so the review queue is not empty.
  for (const [amount, merchant, method, bank, last4, hoursAgo] of [
    [1250, 'Amazon', 'upi', 'HDFC Bank', '1234', 2],
    [420, 'Swiggy', 'upi', 'HDFC Bank', '1234', 6],
    [780, null, 'card', 'HDFC Bank', '9012', 26],
  ] as [number, string | null, string, string, string, number][]) {
    const when = new Date(Date.now() - hoursAgo * 3600_000);
    docs.push({
      _id: newId(),
      user_id: userId,
      account_id: salary._id,
      to_account_id: null,
      category_id: null,
      person_id: me,
      type: 'expense',
      bucket: 'personal',
      need_level: 'need',
      amount,
      txn_date: iso(when),
      transaction_at: when,
      merchant,
      note: null,
      reason: null,
      source: 'sms',
      status: 'detected',
      payment_method: method,
      bank,
      account_last4: last4,
      raw_reference: `SEED${Math.floor(Math.random() * 1e12)}`,
      raw_message: null,
      created_at: now,
      updated_at: now,
    });
  }

  await transactions().insertMany(docs, { ordered: false });

  // Investments, SIPs, budgets, bills, loans, goals ---------------------
  const inv = (
    person: string,
    name: string,
    type: string,
    invested: number,
    current: number,
    start: string | null,
    liquid: boolean,
  ) => ({
    _id: newId(),
    user_id: userId,
    person_id: person,
    name,
    type,
    symbol: null,
    units: null,
    avg_price: null,
    last_price: null,
    invested,
    current_value: current,
    start_date: start,
    maturity_date: null,
    liquid,
    notes: null,
    updated_at: now,
    created_at: now,
  });

  const stock = (name: string, symbol: string, units: number, avg: number, last: number, start: string) => ({
    ...inv(me, name, 'stock', money(units * avg), money(units * last), start, true),
    symbol,
    units,
    avg_price: avg,
    last_price: last,
  });

  await investments().insertMany([
    inv(me, 'Parag Parikh Flexi Cap', 'mutual_fund', 680000, 912000, '2021-04-05', true),
    inv(me, 'Nifty 50 Index Fund', 'mutual_fund', 420000, 538000, '2022-01-10', true),
    stock('HDFC Bank', 'HDFCBANK', 120, 1450, 1682, '2022-06-15'),
    stock('Infosys', 'INFY', 90, 1320, 1498, '2023-02-20'),
    stock('ITC', 'ITC', 200, 398, 441, '2023-07-01'),
    stock('Tata Motors', 'TATAMOTORS', 75, 720, 655, '2024-01-08'),
    inv(me, 'EPF', 'epf', 540000, 612000, '2019-07-01', false),
    inv(me, 'PPF', 'ppf', 300000, 352000, '2020-04-01', false),
    inv(me, 'Sovereign Gold Bond', 'gold', 150000, 198000, '2021-09-12', true),
    inv(mother, 'SBI Bluechip (Mom)', 'mutual_fund', 260000, 318000, '2020-11-01', true),
    inv(mother, 'Bank FD (Mom)', 'fd', 500000, 548000, '2023-03-01', true),
    inv(father, 'Senior Citizen FD (Dad)', 'fd', 900000, 1012000, '2022-08-01', true),
    inv(father, 'LIC Endowment (Dad)', 'other', 240000, 268000, '2018-05-01', false),
  ]);

  await sips().insertMany(
    [
      [me, 'Parag Parikh Flexi Cap', 25000, 5, 13, 10, '2021-04-05'],
      [me, 'Nifty 50 Index Fund', 20000, 5, 12, 10, '2022-01-10'],
      [me, 'Nifty Next 50', 10000, 10, 13, 0, '2023-06-05'],
      [mother, 'SBI Bluechip (Mom)', 5000, 15, 11, 0, '2020-11-01'],
    ].map(([person, name, amount, day, ret, step, start]) => ({
      _id: newId(),
      user_id: userId,
      person_id: person as string,
      investment_id: null,
      name: name as string,
      amount: amount as number,
      day_of_month: day as number,
      expected_return: ret as number,
      step_up_pct: step as number,
      start_date: start as string,
      active: true,
      created_at: now,
    })),
  );

  await budgets().insertMany(
    ([
      ['Groceries', 14000],
      ['Food & dining', 9000],
      ['Transport & fuel', 6000],
      ['Shopping', 8000],
      ['Subscriptions', 2000],
      ['Entertainment', 3000],
      ['Utilities', 5000],
    ] as [string, number][]).map(([name, amount]) => ({
      _id: newId(),
      user_id: userId,
      category_id: catBy(name),
      month: 'default',
      amount,
    })),
  );

  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 3);
  await recurring().insertMany([
    bill('House rent', 32000, catBy('Rent / EMI'), 'home', 'monthly', iso(nextMonth)),
    bill('Broadband + mobile', 1899, catBy('Utilities'), 'home', 'monthly', iso(new Date(now.getFullYear(), now.getMonth(), 18))),
    bill('Netflix + Spotify', 848, catBy('Subscriptions'), 'personal', 'monthly', iso(new Date(now.getFullYear(), now.getMonth(), 22))),
    bill('Term insurance premium', 21000, catBy('Insurance'), 'home', 'yearly', iso(new Date(now.getFullYear() + 1, 2, 12))),
  ]);

  function bill(
    name: string,
    amount: number,
    categoryId: string,
    bucket: 'home' | 'personal',
    frequency: string,
    nextDue: string,
  ) {
    return {
      _id: newId(),
      user_id: userId,
      account_id: salary._id,
      category_id: categoryId,
      name,
      amount,
      type: 'expense' as const,
      bucket,
      frequency,
      next_due: nextDue,
      active: true,
      created_at: now,
    };
  }

  await liabilities().insertOne({
    _id: newId(),
    user_id: userId,
    person_id: me,
    name: 'Car loan',
    type: 'loan',
    principal: 800000,
    outstanding: 412000,
    interest_rate: 9.25,
    emi: 16800,
    end_date: '2028-05-10',
    created_at: now,
  });

  await goals().insertMany(
    ([
      ['Emergency fund', 'emergency', 420000, 420000, 0, null],
      ['House down payment', 'purchase', 2500000, 640000, 35000, iso(new Date(now.getFullYear() + 4, now.getMonth(), 1))],
      ["Parents' health buffer", 'custom', 1000000, 280000, 10000, iso(new Date(now.getFullYear() + 3, now.getMonth(), 1))],
      ['Japan trip', 'purchase', 350000, 96000, 8000, iso(new Date(now.getFullYear() + 1, now.getMonth() + 6, 1))],
    ] as [string, string, number, number, number, string | null][]).map(
      ([name, kind, target, saved, monthly, date]) => ({
        _id: newId(),
        user_id: userId,
        name,
        kind,
        target_amount: target,
        saved_amount: saved,
        monthly_contribution: monthly,
        target_date: date,
        created_at: now,
      }),
    ),
  );

  await merchantRules().insertOne({
    _id: newId(),
    user_id: userId,
    pattern: 'Swiggy',
    match_type: 'contains',
    category_id: catBy('Food & dining'),
    bucket: 'personal',
    need_level: 'want',
    auto_confirm: true,
    hits: 4,
    last_used_at: now,
    created_at: now,
  });

  console.log(`✓ seeded ${docs.length} transactions, 13 investments, 4 SIPs, 4 goals`);
  console.log('  plus 3 detected spends waiting in Needs a look');
  console.log(`  sign in with ${EMAIL} / ${PASSWORD}`);
  await closeClient();
}

main().catch(async (err) => {
  console.error('✗ seed failed:', err.message);
  await closeClient().catch(() => {});
  process.exit(1);
});
