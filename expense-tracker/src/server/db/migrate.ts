/**
 * Applies schema.sql. Safe to run repeatedly - every statement is IF NOT EXISTS.
 *   npm run db:migrate
 *   npm run db:reset    (drops every table first)
 */
import './env';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { closePool, getPool } from './client';

const here = dirname(fileURLToPath(import.meta.url));

const DROP = `
DROP TABLE IF EXISTS net_worth_snapshots, goals, recurring, liabilities, sips,
  investments, budgets, transactions, categories, accounts, people, users CASCADE;
`;

async function main() {
  const reset = process.argv.includes('--reset');
  const sql = await readFile(join(here, 'schema.sql'), 'utf8');
  if (reset) {
    console.log('· dropping existing tables');
    await getPool().query(DROP);
  }
  await getPool().query(sql);
  console.log('✓ schema applied');
  await closePool();
}

main().catch((err) => {
  console.error('✗ migration failed:', err.message);
  process.exit(1);
});
