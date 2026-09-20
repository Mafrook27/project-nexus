/**
 * Fills a fresh database with a believable year of data so every screen has
 * something to show. Safe to re-run: it wipes and rebuilds the seed user only.
 *
 *   npm run db:seed
 */
import './env';
import bcrypt from 'bcryptjs';
import { closePool, query } from './client';
import { DEFAULT_CATEGORIES } from '../../lib/constants';
import type { NeedLevel } from '../../lib/constants';

const EMAIL = process.env.SEED_EMAIL ?? 'demo@paisa.app';
const PASSWORD = process.env.SEED_PASSWORD ?? 'demo1234';
const NAME = process.env.SEED_NAME ?? 'Demo';

const rand = (min: number, max: number) => Math.round(min + Math.random() * (max - min));
const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];
const iso = (d: Date) => d.toISOString().slice(0, 10);

async function main() {
  console.log(`· seeding ${EMAIL}`);
  await query('DELETE FROM users WHERE email = $1', [EMAIL]);

  const hash = await bcrypt.hash(PASSWORD, 10);
  const [user] = await query<{ id: string }>(
    `INSERT INTO users (email, name, password_hash, currency, settings)
     VALUES ($1, $2, $3, 'INR', $4::jsonb) RETURNING id`,
    [
      EMAIL,
      NAME,
      hash,
      JSON.stringify({
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
      }),
    ],
  );
  const userId = user.id;

  // People -------------------------------------------------------------
  const people = await query<{ id: string; name: string }>(
    `INSERT INTO people (user_id, name, relation, color) VALUES
       ($1, $2, 'self', '#2a78d6'),
       ($1, 'Mother', 'mother', '#eb6834'),
       ($1, 'Father', 'father', '#1baf7a')
     RETURNING id, name`,
    [userId, NAME],
  );
  const me = people[0].id;
  const mother = people[1].id;
  const father = people[2].id;

  // Categories ---------------------------------------------------------
  const catValues: unknown[] = [userId];
  const catTuples = DEFAULT_CATEGORIES.map((c) => {
    const base = catValues.length;
    catValues.push(c.name, c.kind, c.bucket, c.icon, c.color, c.need);
    return `($1, $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
  });
  const categories = await query<{
    id: string;
    name: string;
    kind: string;
    bucket: string;
    default_need_level: NeedLevel;
  }>(
    `INSERT INTO categories (user_id, name, kind, bucket, icon, color, default_need_level)
     VALUES ${catTuples.join(', ')}
     RETURNING id, name, kind, bucket, default_need_level`,
    catValues,
  );
  const catBy = (name: string) => categories.find((c) => c.name === name)!.id;
  const expenseCats = categories.filter((c) => c.kind === 'expense');

  // Accounts -----------------------------------------------------------
  const accounts = await query<{ id: string; name: string }>(
    `INSERT INTO accounts (user_id, person_id, name, type, institution, opening_balance, is_emergency)
     VALUES
       ($1, $2, 'HDFC Salary',      'bank',        'HDFC Bank',  85000,  false),
       ($1, $2, 'ICICI Savings',    'bank',        'ICICI Bank', 420000, true),
       ($1, $2, 'Cash wallet',      'cash',        NULL,         6000,   false),
       ($1, $2, 'UPI / Paytm',      'wallet',      'Paytm',      3500,   false),
       ($1, $2, 'HDFC Regalia',     'credit_card', 'HDFC Bank',  0,      false),
       ($1, $3, 'SBI Savings (Mom)','bank',        'SBI',        310000, false)
     RETURNING id, name`,
    [userId, me, mother],
  );
  const salary = accounts[0].id;
  const savings = accounts[1].id;
  const cash = accounts[2].id;
  const upi = accounts[3].id;
  const card = accounts[4].id;

  // Twelve months of transactions --------------------------------------
  const today = new Date();
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

  let inserted = 0;
  for (let back = 11; back >= 0; back--) {
    const monthDate = new Date(today.getFullYear(), today.getMonth() - back, 1);
    const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
    const cap = back === 0 ? Math.min(today.getDate(), daysInMonth) : daysInMonth;

    // Salary on the 1st
    await query(
      `INSERT INTO transactions (user_id, account_id, category_id, person_id, type, bucket, amount, txn_date, merchant)
       VALUES ($1,$2,$3,$4,'income','personal',$5,$6,'Monthly salary')`,
      [
        userId,
        salary,
        catBy('Salary'),
        me,
        150000 + back * -800 + rand(-2000, 2000),
        iso(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)),
      ],
    );
    inserted++;

    // Rent and fixed home costs
    const fixed: [string, number, string][] = [
      ['Rent / EMI', 32000, 'Landlord'],
      ['Utilities', rand(2200, 4200), pick(merchants.Utilities)],
      ['Household help', 4500, 'Help'],
      ['Insurance', 3200, 'HDFC Life'],
    ];
    for (const [catName, amount, merchant] of fixed) {
      await query(
        `INSERT INTO transactions (user_id, account_id, category_id, person_id, type, bucket, need_level, amount, txn_date, merchant)
         VALUES ($1,$2,$3,$4,'expense','home','need',$5,$6,$7)`,
        [
          userId,
          salary,
          catBy(catName),
          me,
          amount,
          iso(new Date(monthDate.getFullYear(), monthDate.getMonth(), rand(2, 6))),
          merchant,
        ],
      );
      inserted++;
    }

    // Everyday spending
    const count = rand(26, 40);
    for (let i = 0; i < count; i++) {
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
      // Roughly a fifth of the "nice to have" spending is money you would take
      // back if you could - which is exactly what the leaks card is for.
      const level: NeedLevel =
        cat.default_need_level === 'want' && Math.random() < 0.28 ? 'waste' : cat.default_need_level;

      await query(
        `INSERT INTO transactions (user_id, account_id, category_id, person_id, type, bucket, need_level, amount, txn_date, merchant)
         VALUES ($1,$2,$3,$4,'expense',$5,$6,$7,$8,$9)`,
        [
          userId,
          pick([salary, upi, cash, card]),
          cat.id,
          me,
          cat.bucket,
          level,
          amount,
          iso(new Date(monthDate.getFullYear(), monthDate.getMonth(), rand(1, cap))),
          pick(names),
        ],
      );
      inserted++;
    }

    // Money moved into savings
    await query(
      `INSERT INTO transactions (user_id, account_id, to_account_id, person_id, type, bucket, amount, txn_date, merchant)
       VALUES ($1,$2,$3,$4,'transfer','personal',$5,$6,'To savings')`,
      [
        userId,
        salary,
        savings,
        me,
        rand(20000, 45000),
        iso(new Date(monthDate.getFullYear(), monthDate.getMonth(), Math.min(5, cap))),
      ],
    );
    inserted++;
  }

  // Investments --------------------------------------------------------
  await query(
    `INSERT INTO investments
       (user_id, person_id, name, type, symbol, units, avg_price, last_price, invested, current_value, start_date, liquid)
     VALUES
       ($1,$2,'Parag Parikh Flexi Cap','mutual_fund',NULL,NULL,NULL,NULL,680000,912000,'2021-04-05',true),
       ($1,$2,'Nifty 50 Index Fund','mutual_fund',NULL,NULL,NULL,NULL,420000,538000,'2022-01-10',true),
       ($1,$2,'HDFC Bank','stock','HDFCBANK',120,1450,1682,174000,201840,'2022-06-15',true),
       ($1,$2,'Infosys','stock','INFY',90,1320,1498,118800,134820,'2023-02-20',true),
       ($1,$2,'ITC','stock','ITC',200,398,441,79600,88200,'2023-07-01',true),
       ($1,$2,'Tata Motors','stock','TATAMOTORS',75,720,655,54000,49125,'2024-01-08',true),
       ($1,$2,'EPF','epf',NULL,NULL,NULL,NULL,540000,612000,'2019-07-01',false),
       ($1,$2,'PPF','ppf',NULL,NULL,NULL,NULL,300000,352000,'2020-04-01',false),
       ($1,$2,'Sovereign Gold Bond','gold',NULL,NULL,NULL,NULL,150000,198000,'2021-09-12',true),
       ($1,$3,'SBI Bluechip (Mom)','mutual_fund',NULL,NULL,NULL,NULL,260000,318000,'2020-11-01',true),
       ($1,$3,'Bank FD (Mom)','fd',NULL,NULL,NULL,NULL,500000,548000,'2023-03-01',true),
       ($1,$4,'Senior Citizen FD (Dad)','fd',NULL,NULL,NULL,NULL,900000,1012000,'2022-08-01',true),
       ($1,$4,'LIC Endowment (Dad)','other',NULL,NULL,NULL,NULL,240000,268000,'2018-05-01',false)`,
    [userId, me, mother, father],
  );

  // SIPs ---------------------------------------------------------------
  await query(
    `INSERT INTO sips (user_id, person_id, name, amount, day_of_month, expected_return, step_up_pct, start_date)
     VALUES
       ($1,$2,'Parag Parikh Flexi Cap',25000,5,13,10,'2021-04-05'),
       ($1,$2,'Nifty 50 Index Fund',20000,5,12,10,'2022-01-10'),
       ($1,$2,'Nifty Next 50',10000,10,13,0,'2023-06-05'),
       ($1,$3,'SBI Bluechip (Mom)',5000,15,11,0,'2020-11-01')`,
    [userId, me, mother],
  );

  // Budgets, bills, loans, goals ---------------------------------------
  const budgets: [string, number][] = [
    ['Groceries', 14000],
    ['Food & dining', 9000],
    ['Transport & fuel', 6000],
    ['Shopping', 8000],
    ['Subscriptions', 2000],
    ['Entertainment', 3000],
    ['Utilities', 5000],
  ];
  for (const [name, amount] of budgets) {
    await query(
      `INSERT INTO budgets (user_id, category_id, month, amount) VALUES ($1,$2,'default',$3)`,
      [userId, catBy(name), amount],
    );
  }

  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 3);
  await query(
    `INSERT INTO recurring (user_id, account_id, category_id, name, amount, type, bucket, frequency, next_due)
     VALUES
       ($1,$2,$3,'House rent',32000,'expense','home','monthly',$6),
       ($1,$2,$4,'Broadband + mobile',1899,'expense','home','monthly',$7),
       ($1,$2,$5,'Netflix + Spotify',848,'expense','personal','monthly',$8),
       ($1,$2,$9,'Term insurance premium',21000,'expense','home','yearly',$10)`,
    [
      userId,
      salary,
      catBy('Rent / EMI'),
      catBy('Utilities'),
      catBy('Subscriptions'),
      iso(nextMonth),
      iso(new Date(today.getFullYear(), today.getMonth(), 18)),
      iso(new Date(today.getFullYear(), today.getMonth(), 22)),
      catBy('Insurance'),
      iso(new Date(today.getFullYear() + 1, 2, 12)),
    ],
  );

  await query(
    `INSERT INTO liabilities (user_id, person_id, name, type, principal, outstanding, interest_rate, emi, end_date)
     VALUES ($1,$2,'Car loan','loan',800000,412000,9.25,16800,'2028-05-10')`,
    [userId, me],
  );

  await query(
    `INSERT INTO goals (user_id, name, kind, target_amount, saved_amount, monthly_contribution, target_date)
     VALUES
       ($1,'Emergency fund','emergency',420000,420000,0,NULL),
       ($1,'House down payment','purchase',2500000,640000,35000,$2),
       ($1,'Parents'' health buffer','custom',1000000,280000,10000,$3),
       ($1,'Japan trip','purchase',350000,96000,8000,$4)`,
    [
      userId,
      iso(new Date(today.getFullYear() + 4, today.getMonth(), 1)),
      iso(new Date(today.getFullYear() + 3, today.getMonth(), 1)),
      iso(new Date(today.getFullYear() + 1, today.getMonth() + 6, 1)),
    ],
  );

  console.log(`✓ seeded ${inserted} transactions, 13 investments, 4 SIPs, 4 goals`);
  console.log(`  sign in with ${EMAIL} / ${PASSWORD}`);
  await closePool();
}

main().catch((err) => {
  console.error('✗ seed failed:', err.message);
  process.exit(1);
});
